"""tools/voices/cast.py -- who speaks with which ElevenLabs voice (tools/voices/cast.json).

Each operator is a man or a woman (SEX below: from their bios where the bio says, otherwise from
their full name in the game's data; the few names that could go either way are marked "?" and can
be changed here). Each gets one voice of their sex, matching their accent where the game has one,
spread so no voice is used far more than the others. Run after `elevenlabs.py info` (which lists
the account's voices into account-voices.json)."""
import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SEX = {
    'kiln': 'f', 'torque': 'm', 'rivet': 'f', 'glare': 'm', 'crag': 'm', 'marlow': 'f', 'halcyon': 'f', 'vesper': 'm',
    'static': 'm?', 'quill': 'f', 'pike': 'm', 'brace': 'f', 'haze': 'f', 'wraith': 'f', 'gaff': 'm', 'splice': 'f',
    'tusk': 'm', 'dynamo': 'f', 'triad': 'm', 'rust': 'f', 'skid': 'm', 'grit': 'm', 'span': 'm', 'rung': 'm?',
    'phantom': 'f', 'loop': 'm', 'tremor': 'm', 'kite': 'f', 'murmur': 'f', 'pivot': 'm', 'bound': 'f', 'plummet': 'f',
    'stain': 'f', 'glance': 'f', 'feint': 'm', 'sutler': 'm', 'caster': 'm', 'hound': 'f', 'archive': 'm', 'lodestone': 'f',
    'earshot': 'm', 'anvil': 'm', 'okafor': 'm?', 'brick': 'f', 'tamsin': 'f', 'sable': 'f', 'kestrel': 'f', 'morrow': 'm',
    'juno': 'f', 'hollis': 'm', 'rhea': 'f', 'lark': 'm', 'seam': 'm', 'lumen': 'm', 'nox': 'm', 'moor': 'f',
    'warden': 'm', 'ferro': 'f?', 'mimic': 'f', 'veil': 'f', 'grout': 'f', 'drench': 'm', 'jolt': 'f', 'ferret': 'm',
    'babel': 'f?', 'relay': 'm', 'sink': 'f', 'latch': 'f', 'mirage': 'f', 'harbor': 'f', 'perch': 'm', 'winch': 'f',
    'strain': 'm', 'glint': 'f', 'chaff': 'f', 'bluff': 'm', 'tether': 'm', 'drag': 'f', 'magpie': 'f', 'gust': 'm',
    'canary': 'f', 'carom': 'm',
}
# accents the game gives some operators (DATA operator .voice.lang): british, australian, else american
ACCENT = {'perch': 'british', 'bound': 'british', 'plummet': 'british', 'stain': 'british', 'glance': 'british', 'caster': 'british',
          'hound': 'australian', 'archive': 'british', 'chaff': 'british', 'bluff': 'british', 'tether': 'british', 'drag': 'british',
          'gust': 'british', 'canary': 'british', 'carom': 'british', 'glint': 'british'}
# the ten voices in the cast: six men, four women (fewer voices, fewer recordings of the shared lines)
POOL = {
    'm': ['Adam', 'Harry', 'Brian', 'George', 'Daniel', 'Charlie'],
    'f': ['Sarah', 'Matilda', 'Alice', 'Lily'],
}

if __name__ == '__main__':
    acct = json.load(open(os.path.join(ROOT, 'tools', 'voices', 'account-voices.json'), encoding='utf-8'))
    by = {v['name'].split(' ')[0]: v for v in acct}
    voices = {}
    for g, names in POOL.items():
        for n in names:
            v = by[n]
            voices[n.lower()] = {'id': v['id'], 'name': n, 'g': g, 'accent': v.get('accent') or 'american'}
    use = {k: 0 for k in voices}
    ops = {}
    for op in SEX:
        g = SEX[op][0]
        want = ACCENT.get(op, 'american')
        pool = [k for k, v in voices.items() if v['g'] == g]
        # their accent where there is one, but not at the cost of piling everyone onto one voice
        k = min(pool, key=lambda x: (use[x] + (0 if voices[x]['accent'] == want else 4), x))
        use[k] += 1
        ops[op] = k
    cast = {'voices': voices, 'ops': ops, 'sex': {k: v[0] for k, v in SEX.items()}, 'unsure': [k for k, v in SEX.items() if v.endswith('?')]}
    json.dump(cast, open(os.path.join(ROOT, 'tools', 'voices', 'cast.json'), 'w', encoding='utf-8'), indent=1)
    print('voices used:', use)
    print('names that could go either way (check SEX in cast.py):', cast['unsure'])
