"""tools/voices/extract.py -- every fixed line the game speaks, for recording (tools/voices/lines.json):

    radio   the shared radio calls (VOICE.GENERIC in js/voice.js), said by every operator without
            lines of their own: recorded once in every voice in use
    own     each operator's own lines (VOICE.add in js/voice.js and js/ops3-*.js), in their voice
    cityz   the fixed lines City Z's people say (arrays of plain strings handed to VOICE.say in the
            cityz-*.js files), once in every voice in use. Lines with someone's name in them are
            built while playing and stay with the browser's speech

Run it again whenever lines change; elevenlabs.py only records what isn't recorded yet."""
import glob, json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LIT = r"'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\""
ARR = re.compile(r"\[\s*((?:" + LIT + r")(?:\s*,\s*(?:" + LIT + r"))*)\s*\]")
SKIP = [r"const BIOS = \[.*?\];", r"const FRIENDS = \[.*?\];", r"const ENEMIES = \[.*?\];"]


def unq(s):
    return s[1:-1].replace("\\'", "'").replace('\\"', '"').strip()


def spoken(t):
    return 3 < len(t) <= 100 and re.match(r"[A-Z.]", t) and re.search(r"[a-z]", t) and re.search(r"[.!?]$", t) and ' ' in t


def own():
    out = {}
    for f in ['voice.js', 'ops3-b.js', 'ops3-c.js', 'ops3-d.js']:
        src = open(os.path.join(ROOT, 'js', f), encoding='utf-8').read()
        for m in re.finditer(r"VOICE\.add\('(\w+)',\s*\{", src):
            i, depth = m.end(), 1
            while depth and i < len(src):
                c = src[i]
                if c in "'\"":
                    j = re.match(LIT, src[i:])
                    i += len(j.group(0))
                    continue
                depth += (c == '{') - (c == '}')
                i += 1
            L = out.setdefault(m.group(1), [])
            for s in re.findall(LIT, src[m.end():i]):
                t = unq(s)
                if t and t not in L:
                    L.append(t)
    return out


def radio():
    src = open(os.path.join(ROOT, 'js', 'voice.js'), encoding='utf-8').read()
    m = re.search(r"VOICE\.GENERIC = \{(.*?)\n  \};", src, re.S)
    L = []
    for s in re.findall(LIT, m.group(1)):
        t = unq(s)
        if t not in L:
            L.append(t)
    return L


def cityz():
    out = set()
    for f in sorted(glob.glob(os.path.join(ROOT, 'js', 'cityz-*.js'))):
        src = open(f, encoding='utf-8').read()
        for pat in SKIP:
            src = re.sub(pat, '', src, flags=re.S)
        for m in ARR.finditer(src):
            # only arrays handed to a voice: the call (or a line table) just before them
            before = src[max(0, m.start() - 160):m.start()]
            if not re.search(r"(say|VOICE\.say)\([^()]*$|\w+:\s*$|\?\s*$|:\s*$|L = \{[^}]*$", before):
                continue
            for s in re.findall(LIT, m.group(1)):
                t = unq(s)
                if spoken(t):
                    out.add(t)
    return sorted(out)


if __name__ == '__main__':
    data = {'radio': radio(), 'own': own(), 'cityz': cityz()}
    json.dump(data, open(os.path.join(ROOT, 'tools', 'voices', 'lines.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    n = lambda L: (len(L), sum(len(t) for t in L))
    print('radio %d lines / %d chars · own %d operators, %d lines / %d chars · cityz %d lines / %d chars' % (
        *n(data['radio']), len(data['own']), *n([t for v in data['own'].values() for t in v]), *n(data['cityz'])))
