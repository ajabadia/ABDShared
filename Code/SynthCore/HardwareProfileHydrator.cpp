#include "HardwareProfileHydrator.h"
#include "MiniJsonParser.h"

#include <algorithm>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <sstream>

namespace abd::synth
{

namespace
{

struct GmDefaultEntry
{
    const char* roleName;
    std::uint8_t cc;
    float defVal;
};

constexpr GmDefaultEntry kGmDefaults[] = {
    { "ModulationWheel", 1, 0.0f },       { "PortamentoGlideTime", 5, 0.0f },
    { "PartVolume", 7, 100.0f },          { "PartBalance", 8, 64.0f },
    { "PartPan", 10, 64.0f },             { "FootExpressionPedal", 11, 127.0f },
    { "SustainPedal", 64, 0.0f },         { "PortamentoSwitch", 65, 0.0f },
    { "SostenutoPedal", 66, 0.0f },       { "SoftPedal", 67, 0.0f },
    { "FilterResonance", 71, 64.0f },     { "AmpEnvRelease", 72, 64.0f },
    { "AmpEnvAttack", 73, 64.0f },        { "FilterCutoff", 74, 64.0f },
    { "AmpEnvDecay", 75, 64.0f },         { "Lfo1Rate", 76, 64.0f },
    { "Lfo1Depth", 77, 0.0f },            { "Lfo1Delay", 78, 0.0f },
    { "PartReverbSend", 91, 0.0f },       { "PartChorusSend", 93, 0.0f },
    { "PartDelaySend", 94, 0.0f },
};

std::vector<std::uint8_t> parseHexBytes(const std::string& hexStr)
{
    std::vector<std::uint8_t> out;
    std::istringstream iss(hexStr);
    std::string token;
    while (iss >> token)
    {
        char* endPtr = nullptr;
        const unsigned long val = std::strtoul(token.c_str(), &endPtr, 16);
        if (endPtr != token.c_str() && val <= 0xFFul)
            out.push_back(static_cast<std::uint8_t>(val));
    }
    return out;
}

ControlWireMethod parseControlMethod(const std::string& methodStr) noexcept
{
    if (methodStr == "MIDI_CC") return ControlWireMethod::MidiCc;
    if (methodStr == "NRPN") return ControlWireMethod::Nrpn7Bit;
    if (methodStr == "NRPN_14BIT") return ControlWireMethod::Nrpn14Bit;
    if (methodStr == "SYSEX") return ControlWireMethod::SysEx;
    if (methodStr == "MANUAL") return ControlWireMethod::Manual;
    return ControlWireMethod::None;
}

int readCcField(const json::JsonValue& ctrl) noexcept
{
    for (const char* key : { "cc", "ccNumber", "midiCC" })
        if (const auto* v = ctrl.find(key); v && v->isNumber())
            return static_cast<int>(v->numVal);
    return -1;
}

void populateGmDefaults(UniversalHardwareProfile& profile)
{
    for (const auto& entry : kGmDefaults)
    {
        const std::uint64_t h = hashSemanticRole(entry.roleName);
        const bool exists = std::any_of(profile.bindings.begin(), profile.bindings.end(),
                                        [h](const auto& b) { return b.roleHash == h; });
        if (exists) continue;

        SemanticControlBinding b;
        b.semanticRole = entry.roleName;
        b.roleHash = h;
        b.name = entry.roleName;
        b.functionId = "gm_default";
        b.method = ControlWireMethod::MidiCc;
        b.controlNumber = entry.cc;
        b.wireMin = 0.0f;
        b.wireMax = 127.0f;
        b.wireDefault = entry.defVal;
        profile.bindings.push_back(std::move(b));
    }
}

void hydrateIdentityAndProtocol(const json::JsonValue& root, HardwareIdentityMeta& idMeta)
{
    if (const auto* midId = root.find("midiIdentification"); midId && midId->isObject())
    {
        idMeta.manufacturer = midId->getString("manufacturer");
        idMeta.manufacturerIdBytes = parseHexBytes(midId->getString("manufacturerIdHex"));
        idMeta.model = midId->getString("model");
        idMeta.modelIdBytes = parseHexBytes(midId->getString("modelIdHex"));
        idMeta.sysexHeaderBytes = parseHexBytes(midId->getString("sysexHeaderHex"));
        if (const auto* ports = midId->find("portNameMatches"); ports && ports->isArray())
            for (const auto& kw : ports->arrVal)
                if (kw.isString()) idMeta.portNameMatches.push_back(kw.strVal);
    }

    const auto* bm = root.find("bankManagement");
    const auto* syx = (bm && bm->isObject()) ? bm->find("sysexProtocol") : nullptr;
    if (!syx || !syx->isObject()) return;

    const auto devBytes = parseHexBytes(syx->getString("midiDefaultDeviceIdHex"));
    idMeta.defaultDeviceId = devBytes.empty() ? 0x10 : devBytes.front();
    idMeta.defaultChannel = static_cast<std::uint8_t>(std::clamp(syx->getInt("midiDefaultChannel", 1), 1, 16));
    idMeta.useRolandChecksum = (syx->getString("checksumAlgorithm") == "ROLAND_7BIT");
    if (const auto* ports = syx->find("portNameMatches"); ports && ports->isArray())
    {
        for (const auto& kw : ports->arrVal)
        {
            if (kw.isString() &&
                std::find(idMeta.portNameMatches.begin(), idMeta.portNameMatches.end(), kw.strVal) ==
                    idMeta.portNameMatches.end())
                idMeta.portNameMatches.push_back(kw.strVal);
        }
    }
}

SemanticControlBinding hydrateControl(const json::JsonValue& ctrl, const std::string& fnId)
{
    SemanticControlBinding b;
    b.functionId = fnId;
    b.name = ctrl.getString("name");

    const std::string rawRole = ctrl.getString("semanticRole");
    if (!rawRole.empty())
    {
        const std::string_view canonical = normalizeSemanticRoleAlias(rawRole);
        b.semanticRole.assign(canonical.data(), canonical.size());
        b.roleHash = hashSemanticRole(canonical);
        b.isPerKeyDrum = (canonical.rfind("DrumKey", 0) == 0);
    }

    b.method = parseControlMethod(ctrl.getString("controlMethod"));
    if (b.method == ControlWireMethod::MidiCc)
    {
        const int cc = readCcField(ctrl);
        if (cc >= 0 && cc <= 127) b.controlNumber = static_cast<std::uint8_t>(cc);
        else b.method = ControlWireMethod::None;
    }
    else if (b.method == ControlWireMethod::Nrpn7Bit || b.method == ControlWireMethod::Nrpn14Bit)
    {
        const int nrpn = ctrl.getInt("nrpn", -1);
        if (nrpn >= 0 && nrpn <= 16383)
        {
            b.controlNumber = static_cast<std::uint8_t>((nrpn >> 7) & 0x7F);
            b.subNumber = static_cast<std::uint8_t>(nrpn & 0x7F);
        }
        else b.method = ControlWireMethod::None;
    }
    else if (b.method == ControlWireMethod::SysEx)
    {
        b.sysexAddress = ctrl.getString("sysexAddress");
        const auto addr = parseHexBytes(b.sysexAddress);
        b.sysexAddrLen = static_cast<std::uint8_t>(std::min<std::size_t>(addr.size(), 4u));
        for (std::size_t i = 0; i < b.sysexAddrLen; ++i) b.sysexAddrBytes[i] = addr[i];
    }

    float minV = static_cast<float>(ctrl.getNumber("minVal", 0.0));
    float maxV = static_cast<float>(ctrl.getNumber("maxVal", 127.0));
    float defV = static_cast<float>(ctrl.getNumber("defaultVal", 64.0));
    if ((b.method == ControlWireMethod::MidiCc || b.method == ControlWireMethod::Nrpn7Bit) &&
        minV == 0.0f && maxV == 1.0f)
    {
        minV = 0.0f;
        maxV = 127.0f;
        defV = std::clamp(defV, 0.0f, 1.0f) * 127.0f;
    }
    b.wireMin = minV;
    b.wireMax = maxV;
    b.wireDefault = defV;
    return b;
}

} // namespace

UniversalHardwareProfile HardwareProfileHydrator::makeGenericGmProfile()
{
    UniversalHardwareProfile p;
    p.id = "generic_midi";
    p.displayName = "Generic MIDI 1.0 / GM Device";
    populateGmDefaults(p);
    p.rebuildLookupTables();
    return p;
}

bool HardwareProfileHydrator::hydrateFromJsonString(std::string_view jsonText,
                                                    UniversalHardwareProfile& outProfile,
                                                    bool applyGmFallbacks,
                                                    std::string* outError)
{
    json::JsonValue root;
    if (!json::parseJson(jsonText, root, outError) || !root.isObject())
    {
        if (outError && outError->empty()) *outError = "Contract JSON root is not an object";
        return false;
    }

    const std::string idStr = root.getString("id");
    if (idStr.empty() || (!root.find("functions") && !root.find("midiIdentification")))
    {
        if (outError) *outError = "JSON is not a hardware profile contract";
        return false;
    }

    UniversalHardwareProfile p;
    p.id = idStr;
    p.displayName = root.getString("displayName", idStr);
    if (const auto* aliases = root.find("aliases"); aliases && aliases->isArray())
        for (const auto& item : aliases->arrVal)
            if (item.isString()) p.aliases.push_back(item.strVal);

    hydrateIdentityAndProtocol(root, p.identity);

    if (const auto* funcs = root.find("functions"); funcs && funcs->isArray())
    {
        for (const auto& fn : funcs->arrVal)
        {
            if (!fn.isObject()) continue;
            const std::string fnId = fn.getString("id");
            const auto* ctrls = fn.find("controls");
            if (!ctrls || !ctrls->isArray()) continue;
            for (const auto& ctrl : ctrls->arrVal)
                if (ctrl.isObject()) p.bindings.push_back(hydrateControl(ctrl, fnId));
        }
    }

    if (applyGmFallbacks) populateGmDefaults(p);
    p.rebuildLookupTables();
    outProfile = std::move(p);
    return true;
}

bool HardwareProfileHydrator::hydrateFromJsonFile(const std::string& filePath,
                                                  UniversalHardwareProfile& outProfile,
                                                  bool applyGmFallbacks,
                                                  std::string* outError)
{
    std::ifstream ifs(filePath, std::ios::binary);
    if (!ifs.is_open())
    {
        if (outError) *outError = "Unable to open contract JSON file: " + filePath;
        return false;
    }
    std::ostringstream ss;
    ss << ifs.rdbuf();
    return hydrateFromJsonString(ss.str(), outProfile, applyGmFallbacks, outError);
}

std::size_t HardwareProfileHydrator::loadDirectory(const std::string& directoryPath,
                                                   std::vector<UniversalHardwareProfile>& outProfiles,
                                                   bool applyGmFallbacks)
{
    namespace fs = std::filesystem;
    std::error_code ec;
    if (!fs::exists(directoryPath, ec) || !fs::is_directory(directoryPath, ec))
        return 0;

    std::size_t loaded = 0;
    for (const auto& entry : fs::directory_iterator(directoryPath, ec))
    {
        if (!entry.is_regular_file(ec)) continue;
        const std::string fn = entry.path().filename().string();
        if (fn.size() < 6 || fn.rfind(".json") != fn.size() - 5 || fn.find(".schema.json") != std::string::npos
            || fn.find("_parameter_spec.json") != std::string::npos || fn.find("_modulation_matrix.json") != std::string::npos)
            continue;
        UniversalHardwareProfile prof;
        if (hydrateFromJsonFile(entry.path().string(), prof, applyGmFallbacks, nullptr))
        {
            outProfiles.push_back(std::move(prof));
            ++loaded;
        }
    }
    return loaded;
}

} // namespace abd::synth
