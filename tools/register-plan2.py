# 用 ORB 特征匹配把标注截图配准到航拍原图，再换算 12 个标号的沙盘坐标
import cv2, numpy as np

crop = cv2.imread(r'C:/Users/Administrator/.workbuddy/clipboard-images/clipboard-2026-09-15T15-43-26-184Z-22b10d05.jpg', cv2.IMREAD_GRAYSCALE)
aerial = cv2.imread(r'C:/Users/Administrator/Documents/New project/venue-model-study/site-aerial-original.jpg', cv2.IMREAD_GRAYSCALE)

orb = cv2.ORB_create(nfeatures=6000)
kc, dc = orb.detectAndCompute(crop, None)
ka, da = orb.detectAndCompute(aerial, None)
bf = cv2.BFMatcher(cv2.NORM_HAMMING)
matches = bf.knnMatch(dc, da, k=2)
good = [m for m, n in matches if m.distance < 0.75*n.distance]
print('good matches:', len(good))
src = np.float32([kc[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
dst = np.float32([ka[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
M, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3)
print('inliers:', int(inliers.sum()))
print('M=\n', M)
scale = np.hypot(M[0, 0], M[0, 1])
print('scale:', round(float(scale), 4))

# 12 个标号在截图里的像素位置（人工读取，红字中心）
marks = {
 1: (640, 622),    # 锦鲤池庭院（仪式/拍照）
 2: (528, 580),    # 主楼东草坪
 3: (505, 545),
 4: (458, 530),
 5: (442, 608),    # 主楼屋顶（天台）
 6: (477, 608),
 7: (440, 632),
 8: (470, 634),
 9: (163, 492),    # 长屋东草坪（迎宾/甜品）
 10: (135, 404),   # 白架棚泳池
 11: (128, 510),   # 泳池南小亭
 12: (125, 372),   # 泳池西长屋北段
}
pts = np.float32([[x, y] for x, y in marks.values()]).reshape(-1, 1, 2)
mapped = cv2.transform(pts, M).reshape(-1, 2)
print('\n标号 -> 航拍px -> 沙盘坐标 x=(px-853)*0.06, z=(py-639.5)*0.06')
for (k, _), (ax, ay) in zip(marks.items(), mapped):
    x = (ax-853)*0.06; z = (ay-639.5)*0.06
    print(f'{k:>2}: aerial=({ax:6.1f},{ay:6.1f})  world=({x:6.2f},{z:6.2f})')
