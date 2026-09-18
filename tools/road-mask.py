# 从航拍原图采样，分类出路面/草坪/裸土/建筑，用于判断桌位是否压路
from PIL import Image
im = Image.open(r'C:/Users/Administrator/Documents/New project/venue-model-study/site-aerial-original.jpg').convert('RGB')
W, H = im.size
px = im.load()

def w2a(x, z):
    return int(round(x/0.06 + 853)), int(round(z/0.06 + 639.5))

def classify(x, z):
    ax, ay = w2a(x, z)
    if not (0 <= ax < W and 0 <= ay < H):
        return '?'
    r, g, b = px[ax, ay]
    mx, mn = max(r, g, b), min(r, g, b)
    sat = (mx - mn) / mx if mx else 0
    if sat > .18 and g >= r and g >= b:
        return '.'          # 绿：草坪/植被
    if sat > .18 and r > g:
        return '#'          # 偏红棕：屋顶/裸土
    v = mx
    if v > 150:
        return 'R'          # 亮灰白：路面/硬化地
    return 'o'              # 暗：阴影/水面等

pts = {
 '②': (13.5, 17.5), '③': (10.5, 12), '④': (2.5, 12),
 '新1': (19, 12), '新2': (25, 17), '新3': (19.5, 23),
 '天台⑤': (3.3, 18.4), '仪式①': (21.25, 21.06),
}
print('=== 现有桌位在航拍上的地物 (# 屋顶/裸土, R 路面/硬化, . 草坪, o 暗) ===')
for k, (x, z) in pts.items():
    print(f'{k:>5} world=({x:6.2f},{z:6.2f})  aerial={w2a(x,z)}  -> {classify(x,z)}')

print()
print('=== 主楼东侧区域地物图 (x 0..32, z 4..36) ===')
print('       x: ' + ''.join(str(int(x) % 10) for x in range(0, 33)))
for z in range(4, 37, 1):
    row = ''.join(classify(x, z) for x in range(0, 33))
    print(f'z={z:>3}: {row}')
