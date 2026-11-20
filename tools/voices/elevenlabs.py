"""tools/voices/elevenlabs.py -- BLOCKADE's recorded voice lines, made with ElevenLabs.

The game speaks its lines with the browser's text-to-speech unless a recording exists. This makes
the recordings, most-heard first:

    radio   the shared radio calls, in every voice of the cast (every operator can say them)
    own     each operator's own lines, in their voice
    cityz   City Z's fixed lines, in every voice of the cast

    python tools/voices/elevenlabs.py info        plan, credits left, the voices on the account
    python tools/voices/elevenlabs.py plan        what is left to make and what it costs (no calls)
    python tools/voices/elevenlabs.py make        make what's missing, in that order, until done or
                                                   until the credits get down to the floor (FLOOR)

It never spends past FLOOR credits left, and picks up where it stopped on the next run (after the
credits reset, say). The API key is read from tools/elevenlabs.key (or "tools/elevenlabs key.txt"):
it is never printed or written anywhere else, and those files are git-ignored. Inputs: lines.json
(extract.py) and cast.json (cast.py). Output: voices/<voice>/<hash>.mp3 and voices/index.json,
which the game reads (js/voice.js)."""
import json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'voices')
API = 'https://api.elevenlabs.io/v1'
MODEL = 'eleven_flash_v2_5'          # quick and cheap; fine for short radio calls
FORMAT = 'mp3_22050_32'              # small files: a two-second call is about 8 KB
FLOOR = 150                          # credits always left untouched
SETTINGS = {'stability': 0.45, 'similarity_boost': 0.8, 'style': 0.2, 'use_speaker_boost': True}


def key():
    for name in ('elevenlabs.key', 'elevenlabs key.txt', 'elevenlabs.txt'):
        p = os.path.join(ROOT, 'tools', name)
        if os.path.exists(p):
            k = open(p, encoding='utf-8').read().strip()
            if k:
                return k
    sys.exit('No API key: put it in tools/elevenlabs.key (git-ignored).')


def call(path, body=None, raw=False):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'xi-api-key': key(), 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' if raw else 'application/json'},
                                 method='POST' if body is not None else 'GET')
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                return data if raw else json.loads(data)
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            if e.code == 429 or e.code >= 500:
                time.sleep(2 + attempt * 3)
                continue
            sys.exit('ElevenLabs said %d: %s' % (e.code, msg))
        except urllib.error.URLError:
            time.sleep(2 + attempt * 3)
    sys.exit('ElevenLabs did not answer.')


def h(text):
    """FNV-1a over the text's UTF-16 code units, as js/voice.js does it"""
    x = 0x811c9dc5
    b = text.strip().encode('utf-16-le')
    for i in range(0, len(b), 2):
        x ^= b[i] | (b[i + 1] << 8)
        x = (x * 0x01000193) & 0xffffffff
    return '%08x' % x


def jobs():
    lines = json.load(open(os.path.join(ROOT, 'tools', 'voices', 'lines.json'), encoding='utf-8'))
    cast = json.load(open(os.path.join(ROOT, 'tools', 'voices', 'cast.json'), encoding='utf-8'))
    voices, who = cast['voices'], cast['ops']
    order, seen = [], set()
    def add(tier, slug, text):
        k = (slug, h(text))
        if k not in seen:
            seen.add(k); order.append((tier, slug, k[1], text))
    for slug in voices:
        for t in lines['radio']:
            add('radio', slug, t)
    for op, texts in lines['own'].items():
        if op in who:
            for t in texts:
                add('own', who[op], t)
    for slug in voices:
        for t in lines['cityz']:
            add('cityz', slug, t)
    return order, cast


def index():
    p = os.path.join(OUT, 'index.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {'v': 1, 'ops': {}, 'sex': {}, 'voices': {}, 'files': {}}


def save(idx, cast):
    idx['ops'], idx['sex'] = cast['ops'], cast['sex']
    idx['voices'] = {k: v['g'] for k, v in cast['voices'].items()}
    os.makedirs(OUT, exist_ok=True)
    json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), separators=(',', ':'))


def left():
    s = call('/user/subscription')
    return s['character_limit'] - s['character_count']


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'plan'
    if cmd == 'info':
        s = call('/user/subscription')
        print('plan: %s · credits used %s of %s this period' % (s.get('tier'), s.get('character_count'), s.get('character_limit')))
        rows = []
        for x in call('/voices').get('voices', []):
            L = x.get('labels') or {}
            rows.append({'id': x['voice_id'], 'name': x['name'], 'category': x.get('category'), 'gender': L.get('gender'), 'accent': L.get('accent'), 'age': L.get('age'), 'desc': L.get('description') or L.get('descriptive')})
        json.dump(rows, open(os.path.join(ROOT, 'tools', 'voices', 'account-voices.json'), 'w', encoding='utf-8'), indent=1)
        for r in rows:
            print('%-26s %-10s %-8s %-11s %s' % (r['name'][:26], r['category'], r['gender'], r['accent'], r['age']))
        return
    order, cast = jobs()
    idx = index()
    have = idx['files']
    todo = [j for j in order if j[2] not in have.get(j[1], {})]
    if cmd == 'plan':
        for tier in ('radio', 'own', 'cityz'):
            T = [j for j in todo if j[0] == tier]
            print('%-6s %4d lines to make, %6d characters' % (tier, len(T), sum(len(j[3]) for j in T)))
        print('in all %d lines, %d characters (%s)' % (len(todo), sum(len(j[3]) for j in todo), MODEL))
        return
    if cmd == 'make':
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else len(todo)
        budget = left() - FLOOR
        print('credits left %d (keeping %d): making up to %d lines' % (budget + FLOOR, FLOOR, min(limit, len(todo))), flush=True)
        made, spent = 0, 0
        for tier, slug, hh, text in todo[:limit]:
            if len(text) > budget - spent:
                print('stopping: the next line would go past the floor'); break
            audio = call('/text-to-speech/%s?output_format=%s' % (cast['voices'][slug]['id'], FORMAT), {'text': text, 'model_id': MODEL, 'voice_settings': SETTINGS}, raw=True)
            d = os.path.join(OUT, slug)
            os.makedirs(d, exist_ok=True)
            open(os.path.join(d, hh + '.mp3'), 'wb').write(audio)
            have.setdefault(slug, {})[hh] = 1
            made += 1
            spent += len(text)
            if made % 20 == 0:
                save(idx, cast)
                budget = left() - FLOOR; spent = 0          # the real figure, now and then
                print('made %d · %s · credits left %d' % (made, tier, budget + FLOOR), flush=True)
        save(idx, cast)
        print('made %d lines; credits left %d' % (made, left()))


if __name__ == '__main__':
    main()
