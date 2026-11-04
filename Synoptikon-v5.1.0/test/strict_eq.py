import plistlib, sys
def eq(a, b, path='$'):
    if type(a) is not type(b): raise SystemExit(f'type differs at {path}: {type(a).__name__} vs {type(b).__name__}')
    if isinstance(a, dict):
        if list(a.keys()) != list(b.keys()): raise SystemExit(f'keys differ at {path}')
        for k in a: eq(a[k], b[k], f'{path}.{k}')
    elif isinstance(a, list):
        if len(a) != len(b): raise SystemExit(f'len differs at {path}')
        for i, (x, y) in enumerate(zip(a, b)): eq(x, y, f'{path}[{i}]')
    elif a != b: raise SystemExit(f'value differs at {path}: {a!r} vs {b!r}')
a = plistlib.load(open(sys.argv[1], 'rb')); b = plistlib.load(open(sys.argv[2], 'rb')); eq(a, b); print('equal')
