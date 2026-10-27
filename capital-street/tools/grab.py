"""grab.py THEME TYPE W S E N OUT [col,col,...] : copy every Overture feature whose bbox touches the box into OUT.parquet"""
import sys, pyarrow.parquet as pq, pyarrow as pa, pyarrow.compute as pc
from concurrent.futures import ThreadPoolExecutor
from overture_http import RangeFile, listing
theme, typ, W, S, E, N, out = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:7]), sys.argv[7]
cols = sys.argv[8].split(',') if len(sys.argv) > 8 else None
files = listing(f'release/2026-10-21.0/theme={theme}/type={typ}/')
def scan(kf):
    k, size = kf
    f = pq.ParquetFile(RangeFile(k, size)); md = f.metadata
    names = [md.schema.column(i).path for i in range(md.num_columns)]
    ix = {n: names.index('bbox.' + n) for n in ('xmin', 'xmax', 'ymin', 'ymax')}
    gs = [g for g in range(md.num_row_groups) if (lambda st: st['xmin'].min <= E and st['xmax'].max >= W and st['ymin'].min <= N and st['ymax'].max >= S)({n: md.row_group(g).column(i).statistics for n, i in ix.items()})]
    tabs = []
    for g in gs:
        t = f.read_row_group(g, columns=[c for c in cols if c in f.schema_arrow.names] if cols else None)
        b = t.column('bbox')
        m = pc.and_(pc.and_(pc.less_equal(pc.struct_field(b, 'xmin'), E), pc.greater_equal(pc.struct_field(b, 'xmax'), W)),
                    pc.and_(pc.less_equal(pc.struct_field(b, 'ymin'), N), pc.greater_equal(pc.struct_field(b, 'ymax'), S)))
        tabs.append(t.filter(m))
    return tabs
with ThreadPoolExecutor(32) as ex: tabs = [t for ts in ex.map(scan, files) for t in ts]
t = pa.concat_tables(tabs, promote_options='default') if tabs else None
pq.write_table(t, out)
print(out, t.num_rows)
