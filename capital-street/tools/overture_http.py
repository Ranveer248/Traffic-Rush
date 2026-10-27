import io, requests, re, threading
S = requests.Session()
BASE = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
class RangeFile(io.RawIOBase):
    """Read-only seekable file over HTTP range requests, with a small block cache."""
    def __init__(self, key, size):
        self.url, self.size, self.pos, self.cache = BASE + key, size, 0, {}
    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos
    def read(self, n=-1):
        if n < 0: n = self.size - self.pos
        n = min(n, self.size - self.pos)
        if n <= 0: return b''
        for i in range(4):
            try:
                r = S.get(self.url, headers={'Range': f'bytes={self.pos}-{self.pos+n-1}'}, timeout=120)
                r.raise_for_status(); break
            except Exception:
                if i == 3: raise
        self.pos += len(r.content)
        return r.content
    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)
def listing(prefix):
    out, token = [], None
    while True:
        u = BASE + '?list-type=2&prefix=' + prefix + ('&continuation-token=' + requests.utils.quote(token) if token else '')
        t = S.get(u, timeout=60).text
        out += list(zip(re.findall(r'<Key>([^<]*)</Key>', t), map(int, re.findall(r'<Size>([^<]*)</Size>', t))))
        m = re.search(r'<NextContinuationToken>([^<]*)</NextContinuationToken>', t)
        if not m: return out
        token = m.group(1)
