# 规则：中心 + 1.3m rim 内不得出现路面 R / 建筑 #（树冠 o 与草坪 . 可用）
from PIL import Image
import math
im = Image.open(r'C:/Users/Administrator/Documents/New project/venue-model-study/site-aerial-original.jpg').convert('RGB')
px = im.load(); W, H = im.size
def w2a(x, z): return int(round(x/0.06 + 853)), int(round(z/0.06 + 639.5))
def cls(x, z):
    ax, ay = w2a(x, z)
    if not (0 <= ax < W and 0 <= ay < H): return '?'
    r, g, b = px[ax, ay]; mx, mn = max(r, g, b), min(r, g, b)
    sat = (mx-mn)/mx if mx else 0
    if sat > .18 and g >= r and g >= b: return '.'
    if sat > .18 and r > g: return '#'
    return 'R' if mx > 150 else 'o'

def ok(x, z, r=1.3):
    if cls(x, z) in 'R#?': return False
    for k in range(8):
        a = k/8*math.pi*2
        if cls(x+math.cos(a)*r, z+math.sin(a)*r) in 'R#?': return False
    return True

print('=== 可用桌心 (O=可用, 其余为原地物) ===')
print('     x: ' + ''.join(str(int(x)%10) for x in range(0, 30)))
cells = []
for z in range(8, 33):
    row = ''
    for x in range(0, 30):
        o = ok(x, z)
        if o: cells.append((x, z))
        row += 'O' if o else cls(x, z)
    print(f'z={z:>3}: {row}')

# 靠近 ②③④ 标记点选 3 桌 + 向南/东再选 3 桌，彼此 >=5.0m
marks = {'②': (11.18, 17.28), '③': (9.11, 14.13), '④': (4.88, 12.78)}
picked = []
def far(p, lst, d=5.0): return all(math.hypot(p[0]-q[0], p[1]-q[1]) >= d for q in lst)
for name, m in marks.items():
    best = min(cells, key=lambda c: math.hypot(c[0]-m[0], c[1]-m[1]))
    if far(best, picked): picked.append(best)
    print(f'{name} 标记 {m} -> 落点 {best}')
print('已选:', picked)
# 再挑 3 个：优先靠近已选点（聚合），且彼此 >=5.0
for _ in range(3):
    cand = [c for c in cells if far(c, picked)]
    if not cand: break
    best = min(cand, key=lambda c: min(math.hypot(c[0]-p[0], c[1]-p[1]) for p in picked))
    picked.append(best)
print('最终 6 桌草坪点位:', picked)
