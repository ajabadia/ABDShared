// ─────────────────────────── GrooveArpeggiator ───────────────────────────
// Included inside `namespace abd::synth::tests` by SynthCoreTests.cpp.

struct GrooveArpCollector
{
    abd::synth::GrooveArpeggiator::NoteEvent ev[256];
    int n = 0;
    void operator()(const abd::synth::GrooveArpeggiator::NoteEvent& e)
    {
        if (n < 256) ev[n++] = e;
    }
};

static void testGrooveArpeggiatorMotifsAndZeroAlloc()
{
    printf("=== GrooveArpeggiator: motifs, zero-alloc and allNotesOff ===\n");

    // 1. Alt1Inclusive vs Alt2Exclusive on [60, 64, 67]
    auto collectNotes = [](abd::synth::GrooveArpMotif motif, int* out, int maxN) -> int
    {
        abd::synth::GrooveArpeggiator arp;
        arp.prepare(44100.0);
        arp.setEnabled(true);
        arp.setTempoBPM(120.0f);
        arp.setSyncResolution(3); // 1/16 = 8 steps/sec -> 5512.5 spls
        arp.setGateTime(0.5f);
        arp.setMotif(motif);
        arp.noteOn(60, 1.0f);
        arp.noteOn(64, 0.9f);
        arp.noteOn(67, 0.8f);

        GrooveArpCollector c;
        arp.generate(44100, c);
        int count = 0;
        for (int i = 0; i < c.n && count < maxN; ++i)
            if (c.ev[i].isNoteOn) out[count++] = c.ev[i].note;
        return count;
    };

    int seq1[16] {}, n1 = collectNotes(abd::synth::GrooveArpMotif::Alt1Inclusive, seq1, 16);
    const int expAlt1[6] = { 60, 64, 67, 67, 64, 60 };
    bool okAlt1 = (n1 >= 6);
    for (int i = 0; okAlt1 && i < 6; ++i) okAlt1 = (seq1[i] == expAlt1[i]);
    check(okAlt1, "GrooveArpeggiator Alt1Inclusive reproduces [60,64,67,67,64,60]");

    int seq2[16] {}, n2 = collectNotes(abd::synth::GrooveArpMotif::Alt2Exclusive, seq2, 16);
    const int expAlt2[5] = { 60, 64, 67, 64, 60 };
    bool okAlt2 = (n2 >= 5);
    for (int i = 0; okAlt2 && i < 5; ++i) okAlt2 = (seq2[i] == expAlt2[i]);
    check(okAlt2, "GrooveArpeggiator Alt2Exclusive reproduces [60,64,67,64,60]");

    // 2. Zero-alloc across 64 blocks + StrumUp staggered offsets
    abd::synth::GrooveArpeggiator arp;
    arp.prepare(48000.0);
    arp.setEnabled(true);
    arp.setMotif(abd::synth::GrooveArpMotif::StrumUp);
    arp.setStrumMs(8.0f);
    arp.setGateTime(0.5f);
    arp.noteOn(60, 0.9f);
    arp.noteOn(64, 0.9f);
    arp.noteOn(67, 0.9f);

    int firstThreeAbs[3] = { -1, -1, -1 };
    int idx = 0;
    const long long beforeAlloc = gTestAllocations;
    for (int b = 0; b < 64; ++b)
    {
        GrooveArpCollector blockC;
        arp.generate(512, blockC);
        for (int i = 0; i < blockC.n; ++i)
        {
            if (blockC.ev[i].isNoteOn && idx < 3)
                firstThreeAbs[idx++] = b * 512 + blockC.ev[i].sampleOffset;
        }
    }
    const long long deltaAlloc = gTestAllocations - beforeAlloc;
    check(deltaAlloc == 0, "GrooveArpeggiator generate() performs zero heap allocations");

    check(idx == 3 && firstThreeAbs[0] < firstThreeAbs[1] && firstThreeAbs[1] < firstThreeAbs[2],
          "GrooveArpeggiator StrumUp staggers chord note-ons by sample offset");

    arp.allNotesOff();
    GrooveArpCollector offC;
    arp.generate(512, offC);
    bool anyOnAfterFlush = false;
    for (int i = 0; i < offC.n; ++i)
        if (offC.ev[i].isNoteOn) anyOnAfterFlush = true;
    check(!anyOnAfterFlush, "GrooveArpeggiator emits zero note-on after allNotesOff()");
}

static void testGrooveArpeggiatorSwingAndLatch()
{
    printf("=== GrooveArpeggiator: bipolar swing, LatchReArm and step mask ===\n");

    auto measureOnTimes = [](float swingPct, double* outSec, int maxOut) -> int
    {
        abd::synth::GrooveArpeggiator arp;
        arp.prepare(48000.0);
        arp.setEnabled(true);
        arp.setTempoBPM(120.0f);
        arp.setSyncResolution(3); // 1/16 -> 0.125s = 6000 samples
        arp.setGateTime(0.5f);
        arp.setSwingPercent(swingPct);
        arp.noteOn(60, 0.8f);
        arp.noteOn(64, 0.8f);

        int count = 0;
        for (int b = 0; b < 2000 && count < maxOut; ++b)
        {
            GrooveArpCollector c;
            arp.generate(48, c);
            for (int i = 0; i < c.n && count < maxOut; ++i)
                if (c.ev[i].isNoteOn)
                    outSec[count++] = (b * 48.0 + c.ev[i].sampleOffset) / 48000.0;
        }
        return count;
    };

    double tZero[32] {}, tPlus50[32] {};
    const int c0 = measureOnTimes(0.0f, tZero, 32);
    const int c50 = measureOnTimes(50.0f, tPlus50, 32);
    check(c0 >= 12 && c50 >= 12, "GrooveArpeggiator emits >= 12 steps in 2 seconds");

    const double avg0 = (tZero[c0 - 1] - tZero[0]) / static_cast<double>(c0 - 1);
    const double avg50 = (tPlus50[c50 - 1] - tPlus50[0]) / static_cast<double>(c50 - 1);
    check(std::abs(avg50 - avg0) < 0.005, "GrooveArpeggiator +50% swing preserves mean step period (<5ms)");

    double var = 0.0;
    for (int i = 1; i < c50; ++i)
    {
        const double d = (tPlus50[i] - tPlus50[i - 1]) - avg50;
        var += d * d;
    }
    const double stddev = std::sqrt(var / static_cast<double>(c50 - 1));
    check(stddev > 0.020, "GrooveArpeggiator +50% swing produces clear even/odd variance (>20ms)");

    // LatchReArm replaces chord when fresh note pressed after full release
    abd::synth::GrooveArpeggiator latchArp;
    latchArp.prepare(44100.0);
    latchArp.setEnabled(true);
    latchArp.setLatchMode(abd::synth::GrooveLatchMode::LatchReArm);
    latchArp.noteOn(60, 0.9f);
    latchArp.noteOff(60);
    check(latchArp.getHeldCount() == 1, "LatchReArm retains chord after release");
    latchArp.noteOn(67, 0.9f);
    check(latchArp.getHeldCount() == 1, "LatchReArm replaces old chord when new note pressed after full release");

    // Step mask rests skip triggering without halting clock
    latchArp.setPatternLength(4);
    latchArp.setStepActive(1, false);
    latchArp.setStepActive(3, false);
    latchArp.setGateTime(0.4f);
    GrooveArpCollector mc;
    latchArp.generate(44100, mc);
    int maskOns = 0;
    for (int i = 0; i < mc.n; ++i)
        if (mc.ev[i].isNoteOn && mc.ev[i].note == 67) ++maskOns;
    check(maskOns >= 2 && maskOns <= 6, "Step mask skips rested steps cleanly");
}

static void testGrooveArpeggiator()
{
    testGrooveArpeggiatorMotifsAndZeroAlloc();
    testGrooveArpeggiatorSwingAndLatch();
}
