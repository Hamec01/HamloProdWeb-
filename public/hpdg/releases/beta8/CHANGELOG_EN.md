# HPDG Beta 8 - guide and changes

Text version of the English PDF.

## Page 1

HAMLOPROD / HPDG
UPDATE GUIDE
BETA 8
What changed since Beta 7, and how to use it. 14 November 2026
YOUR SAMPLE.
YOUR GROOVE.
Beta 8 gives Boom Bap Underground its own groove and bass, lets you decide
how strongly a sample steers generation, copies breaks at the sample's own
tempo and makes the MIDI and sample workflow cleaner.
Inside this release
Boom Bap Underground • Sample influence 1 / 2 / 3 • Copy + Sample Tempo • whole-BPM tempo •
Export Full MIDI as a drum map • your own samples • LuxuryTrap and DarkTrap • 1147 audio
samples
HI-HAT
SNARE
KICK
BASS
An illustration of the musical idea: in Underground the bass lands on the kicks instead of just before them. Not a fixed preset.
Thank you for your support!
I am grateful for your support of HPDG and look forward to your feedback on Beta 8. Write to me
about the sound, generation, interface or workflow: your ideas shape the plugin.
HamloProd • hello@hamloprod.org

## Page 2

HAMLOPROD / HPDG
01 / WHAT'S NEW
Boom Bap and samples
The main additions since the published Beta 7 release.
01 Boom Bap Underground
The substyle formerly called Russian Underground has been rebuilt. Drums play a two-bar loop. Four
groove families bring their own swing, kick shapes, ghost snares and hi-hats; each Generate picks
one. The bass is its own two-bar line built on the real kicks, and it no longer hits just before a kick. A
new HamloProd underground kit of 18 one-shots is used only by this substyle. Projects saved with
Beta 7 still open.
02 Sample influence 1 / 2 / 3
Three buttons in the Instrument Rack header, labelled Sample, set how strongly a loaded sample
steers Guide generation. 3 (default) works as in Beta 7. 2 follows the sample more loosely. 1 keeps
only the lightest guidance, so the genre's own pattern leads. The setting is saved with the project.
Copy Break is not affected.
03 Copy + Sample Tempo
A new copy mode in the sample strip. Copy starts at the left edge of Trim and uses the sample's
tempo, detected or typed with the pencil. The pattern is as long as the selection, 1 to 16 bars. "Play w/
HPDG" and the copied MIDI restart together, and the DAW tempo is not changed.

## Page 3

HAMLOPROD / HPDG
02 / MORE CHANGES
Tempo, MIDI and your sounds
Smaller changes you will notice in everyday work.
04 Whole-BPM tempo
Sample tempo detection now lands on a whole BPM when the loop length confirms it: 77 instead of
76.90, 88 instead of 87.97. Loops are also read as whole bars, so a 4-bar loop is no longer read or
looped as 3 bars.
05 Export Full MIDI as a drum map
Export Full MIDI writes one track with every lane on its own note: Kick 36, Snare 37, HiHat 38, Open
Hat 39, Clap / Ghost Snare 40, Ghost Kick 41, Hat FX 42, Ride 43, Cymbal 44, Perc 45. The bass sits
below, under note 36. Map these notes to your drum sampler once and reuse it. Dragging a single
lane works as before.
06 Your own samples
Load WAV, AIFF, FLAC, MP3 or OGG files, several at once, or drop them straight onto a lane row.
Files up to 30 seconds are accepted, and other formats are converted to WAV. A sample you load
stays on its lane when you regenerate.
07 Boom Bap Classic with a sample
In Guide, the bass reads the sample where "Play w/ HPDG" actually plays it: after Trim, under DAW
Sync and when the loop restarts. Bass 1 answers with short notes in the gaps of the sample's low
end.

## Page 4

HAMLOPROD / HPDG
03 / TRAP AND COPY BREAK
Sharper Trap characters
LuxuryTrap and DarkTrap were refined after listening tests.
08 LuxuryTrap
A steady straight hi-hat carrier with sparse doubles, rattles kept on Hat FX, a two-bar kick call and
answer, the 808 kept in its register and rarer bounce snares and open hats. Lane volumes are
rebalanced: the 808 is lower and the hats and snare are a little louder.
09 DarkTrap
A new drum kit of 131 sounds with 20 808s. Every Generate moves to the next 808; a locked 808
stays. The 808 rhythm is closer to the reference beats, with about one attack a bar, mostly together
with a kick. Pickups are clean triplet runs, the sidechain recovers smoothly and glides play on the
target note. With a sample, Guide accents land where the sample is heard.
10 Copy Break flams
A snare flam stays on the Snare lane instead of turning into a snare and a kick. A quiet kick before a
snare stays a kick.
11 A cleaner rack header
The +Lane button and the RG hint were removed. Rack Vol and Intensity moved closer to the right
edge to make room for the Sample buttons.

## Page 5

HAMLOPROD / HPDG
04 / WORKFLOW
Underground with a sample
A practical way to try the new features together.
1 / Pick the substyle
Choose Boom Bap, then Underground. Press Generate a few times: each seed can bring a different
groove family, with its own swing and kick shape.
2 / Load the loop
Drop your musical loop into the sample strip and Analyze. Check the BPM: if it is wrong, type it with
the pencil.
3 / Choose the influence
Start with Sample 3 to follow the loop closely. If the drums and bass feel too tied to the sample, try 2.
Use 1 when you want the Underground groove itself with only a light touch of the sample.
4 / Export
Use Export Full MIDI to get the whole beat on one track as a drum map, or drag single lanes as
before.
Sample 3 = as Beta 7   |   2 = looser   |   1 = lightest
Applies to Guide generation only. Copy Break always copies the sample as it is.
Results vary with the seed, settings and source sample. Always listen to the generated pattern in your arrangement.

## Page 6

HAMLOPROD / HPDG
05 / INSTALLATION
How to update correctly
Save your project and a backup first. Beta 8 installs over HPDG.
From HPDG / the recommended sequence
1. Open HPDG in your DAW and press Update next to the version.
2. Enter the license key from your purchase email if prompted. It grants update access; it does not
activate the audio engine.
3. Wait for the download. HPDG verifies the installer's SHA-256.
4. Confirm the installer launch. Close the DAW before files are replaced, and follow any installer
request to close applications.
5. Finish installing, restart the DAW and rescan VST3 if needed. Check that the HPDG header shows
0.1.0 Beta 8.
Manually / if Update is unavailable
Visit https://hamloprod.org/en/vst and obtain the installer with your key. Close the DAW and run
HPDG_VST3_Setup_0.1.0-beta.8.exe. Finish installation, reopen the DAW and check the version.
Your projects
The plugin identity is unchanged: projects saved with Beta 7 open in Beta 8 without replacing the
plugin. Boom Bap Underground projects keep their substyle, but a new Generate uses the new
Underground rules.

## Page 7

HAMLOPROD / HPDG
06 / STAY IN TOUCH
Thank you for supporting HPDG
The beta grows through people using it in real projects.
I am grateful for your support and look forward to your feedback.
Help me reproduce the problem
Include your HPDG version, Windows and DAW version, genre / substyle, BPM, seed and the steps
to reproduce. A short audio example helps with a sound issue; a screenshot helps with the interface.
Never post your license key.
Contact HamloProd
hello@hamloprod.org
Plugin page: https://hamloprod.org/en/vst
Rhythm diagrams are teaching examples, not fixed presets or promised Generate results. Third-party sounds in the library
remain the property of their owners; see Documentation/THIRD-PARTY-NOTICES.txt.

