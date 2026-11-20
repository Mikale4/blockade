# Recorded voices (ElevenLabs)

The game speaks every voice line with the browser's text-to-speech **unless a recording of it
exists** in `voices/`; then it plays the recording instead (`js/voice.js`). These tools make the
recordings with ElevenLabs.

## The files

| file | what |
|---|---|
| `extract.py` | collects every fixed line from the game into `lines.json`: the shared radio calls, each operator's own lines, City Z's fixed lines (lines with someone's name in them stay with the browser's speech) |
| `cast.py` | decides who speaks with which voice into `cast.json`: each operator's sex (`SEX`: from their bios, else their full names; the few marked `?` could go either way: change them there), a voice of that sex from a cast of ten (six men, four women), matching their accent where the game has one |
| `elevenlabs.py` | `info` (plan, credits, the account's voices), `plan` (what's left and what it costs), `make` (records what's missing, most-heard first: radio, then own lines, then City Z) |
| `../../voices/` | the recordings (`<voice>/<hash>.mp3`) and `index.json`, which the game reads |

## Running it

1. The API key goes in `tools/elevenlabs.key` (or `tools/elevenlabs key.txt`). It is git-ignored
   and the scripts never print it.
2. After changing lines: `python tools/voices/extract.py`
3. After changing who's who: `python tools/voices/elevenlabs.py info` then `python tools/voices/cast.py`
4. `python tools/voices/elevenlabs.py plan`, then `python tools/voices/elevenlabs.py make`

`make` keeps the last 150 credits (`FLOOR`), stops cleanly when it gets there and picks up where it
stopped on the next run, so it can simply be run again after the monthly credits reset. ElevenLabs'
balance moves late, so the script counts its own spending (at least `START_RATE` credits a
character; this account's Flash rate measured about 0.11) and only lets a fresh balance make that
count worse. (The first full run trusted a stale balance and went down to 18 credits; fixed.) The
account can't go over its limit, so it can't be charged more than the plan.

Where it stands: the radio calls (all ten voices) and every operator's own lines are recorded, and
515 of City Z's 1,349 lines; the other 834 (about 21,000 characters, roughly 2,300 credits) wait for
the next run.

Model `eleven_flash_v2_5`, MP3 at 22 kHz / 32 kbps (a two-second call is about 7 KB).
