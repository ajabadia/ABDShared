#pragma once

#include <cctype>
#include <cstddef>
#include <cstdlib>
#include <map>
#include <string>
#include <string_view>
#include <vector>

namespace abd::synth::json
{

struct JsonValue
{
    enum class Type { Null, Bool, Number, String, Array, Object };

    Type type { Type::Null };
    bool boolVal { false };
    double numVal { 0.0 };
    std::string strVal;
    std::vector<JsonValue> arrVal;
    std::map<std::string, JsonValue> objVal;

    [[nodiscard]] bool isNull() const noexcept { return type == Type::Null; }
    [[nodiscard]] bool isBool() const noexcept { return type == Type::Bool; }
    [[nodiscard]] bool isNumber() const noexcept { return type == Type::Number; }
    [[nodiscard]] bool isString() const noexcept { return type == Type::String; }
    [[nodiscard]] bool isArray() const noexcept { return type == Type::Array; }
    [[nodiscard]] bool isObject() const noexcept { return type == Type::Object; }

    [[nodiscard]] const JsonValue* find(const std::string& key) const noexcept
    {
        if (type != Type::Object) return nullptr;
        const auto it = objVal.find(key);
        return (it != objVal.end()) ? &it->second : nullptr;
    }

    [[nodiscard]] std::string getString(const std::string& key, const std::string& fallback = {}) const
    {
        const auto* v = find(key);
        return (v && v->isString()) ? v->strVal : fallback;
    }

    [[nodiscard]] double getNumber(const std::string& key, double fallback = 0.0) const noexcept
    {
        const auto* v = find(key);
        return (v && v->isNumber()) ? v->numVal : fallback;
    }

    [[nodiscard]] int getInt(const std::string& key, int fallback = 0) const noexcept
    {
        const auto* v = find(key);
        return (v && v->isNumber()) ? static_cast<int>(v->numVal) : fallback;
    }

    [[nodiscard]] bool getBool(const std::string& key, bool fallback = false) const noexcept
    {
        const auto* v = find(key);
        return (v && v->isBool()) ? v->boolVal : fallback;
    }
};

class Parser
{
public:
    explicit Parser(std::string_view src) noexcept : src_(src) {}

    bool parse(JsonValue& out, std::string* err = nullptr)
    {
        skipWs();
        if (!parseValue(out, 0))
        {
            if (err) *err = error_;
            return false;
        }
        skipWs();
        if (pos_ != src_.size())
        {
            if (err) *err = "Unexpected trailing characters after JSON root";
            return false;
        }
        return true;
    }

private:
    static constexpr int kMaxDepth = 64;

    void skipWs() noexcept
    {
        while (pos_ < src_.size())
        {
            const char c = src_[pos_];
            if (c == ' ' || c == '\t' || c == '\r' || c == '\n')
                ++pos_;
            else
                break;
        }
    }

    bool fail(const char* msg)
    {
        error_ = msg;
        return false;
    }

    bool parseValue(JsonValue& out, int depth)
    {
        if (depth > kMaxDepth) return fail("JSON nesting depth exceeded");
        skipWs();
        if (pos_ >= src_.size()) return fail("Unexpected end of JSON input");

        const char c = src_[pos_];
        if (c == '{') return parseObject(out, depth + 1);
        if (c == '[') return parseArray(out, depth + 1);
        if (c == '"') { out.type = JsonValue::Type::String; return parseString(out.strVal); }
        if (c == 't' || c == 'f') return parseBool(out);
        if (c == 'n') return parseNull(out);
        if (c == '-' || (c >= '0' && c <= '9')) return parseNumber(out);
        return fail("Invalid JSON value token");
    }

    bool parseObject(JsonValue& out, int depth)
    {
        out.type = JsonValue::Type::Object;
        ++pos_; // '{'
        skipWs();
        if (pos_ < src_.size() && src_[pos_] == '}') { ++pos_; return true; }

        while (pos_ < src_.size())
        {
            skipWs();
            if (pos_ >= src_.size() || src_[pos_] != '"') return fail("Expected object key string");
            std::string key;
            if (!parseString(key)) return false;

            skipWs();
            if (pos_ >= src_.size() || src_[pos_] != ':') return fail("Expected ':' after key");
            ++pos_;

            JsonValue val;
            if (!parseValue(val, depth)) return false;
            out.objVal.emplace(std::move(key), std::move(val));

            skipWs();
            if (pos_ < src_.size() && src_[pos_] == ',') { ++pos_; continue; }
            if (pos_ < src_.size() && src_[pos_] == '}') { ++pos_; return true; }
            return fail("Expected ',' or '}' in JSON object");
        }
        return fail("Unterminated JSON object");
    }

    bool parseArray(JsonValue& out, int depth)
    {
        out.type = JsonValue::Type::Array;
        ++pos_; // '['
        skipWs();
        if (pos_ < src_.size() && src_[pos_] == ']') { ++pos_; return true; }

        while (pos_ < src_.size())
        {
            JsonValue elem;
            if (!parseValue(elem, depth)) return false;
            out.arrVal.push_back(std::move(elem));

            skipWs();
            if (pos_ < src_.size() && src_[pos_] == ',') { ++pos_; continue; }
            if (pos_ < src_.size() && src_[pos_] == ']') { ++pos_; return true; }
            return fail("Expected ',' or ']' in JSON array");
        }
        return fail("Unterminated JSON array");
    }

    bool parseString(std::string& out)
    {
        ++pos_; // '"'
        out.clear();
        while (pos_ < src_.size())
        {
            const char c = src_[pos_++];
            if (c == '"') return true;
            if (c == '\\')
            {
                if (pos_ >= src_.size()) return fail("Unterminated string escape");
                const char esc = src_[pos_++];
                switch (esc)
                {
                    case '"': case '\\': case '/': out.push_back(esc); break;
                    case 'b': out.push_back('\b'); break;
                    case 'f': out.push_back('\f'); break;
                    case 'n': out.push_back('\n'); break;
                    case 'r': out.push_back('\r'); break;
                    case 't': out.push_back('\t'); break;
                    case 'u':
                        if (pos_ + 4 > src_.size()) return fail("Invalid unicode escape");
                        pos_ += 4; // Skip 4 hex digits safely for ASCII-safe metadata
                        out.push_back('?');
                        break;
                    default: return fail("Unknown escape character");
                }
            }
            else
            {
                out.push_back(c);
            }
        }
        return fail("Unterminated JSON string");
    }

    bool parseBool(JsonValue& out)
    {
        out.type = JsonValue::Type::Bool;
        if (src_.substr(pos_, 4) == "true")  { out.boolVal = true;  pos_ += 4; return true; }
        if (src_.substr(pos_, 5) == "false") { out.boolVal = false; pos_ += 5; return true; }
        return fail("Invalid boolean literal");
    }

    bool parseNull(JsonValue& out)
    {
        if (src_.substr(pos_, 4) == "null") { out.type = JsonValue::Type::Null; pos_ += 4; return true; }
        return fail("Invalid null literal");
    }

    bool parseNumber(JsonValue& out)
    {
        const std::size_t start = pos_;
        if (src_[pos_] == '-') ++pos_;
        while (pos_ < src_.size() && std::isdigit(static_cast<unsigned char>(src_[pos_]))) ++pos_;
        if (pos_ < src_.size() && src_[pos_] == '.')
        {
            ++pos_;
            while (pos_ < src_.size() && std::isdigit(static_cast<unsigned char>(src_[pos_]))) ++pos_;
        }
        if (pos_ < src_.size() && (src_[pos_] == 'e' || src_[pos_] == 'E'))
        {
            ++pos_;
            if (pos_ < src_.size() && (src_[pos_] == '+' || src_[pos_] == '-')) ++pos_;
            while (pos_ < src_.size() && std::isdigit(static_cast<unsigned char>(src_[pos_]))) ++pos_;
        }
        const std::string token(src_.substr(start, pos_ - start));
        char* endPtr = nullptr;
        out.numVal = std::strtod(token.c_str(), &endPtr);
        if (endPtr == token.c_str()) return fail("Invalid number token");
        out.type = JsonValue::Type::Number;
        return true;
    }

    std::string_view src_;
    std::size_t pos_ { 0 };
    std::string error_;
};

[[nodiscard]] inline bool parseJson(std::string_view text, JsonValue& out, std::string* err = nullptr)
{
    Parser parser(text);
    return parser.parse(out, err);
}

} // namespace abd::synth::json
