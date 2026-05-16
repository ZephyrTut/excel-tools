#!/usr/bin/env python3
"""快速分析 xlsx 文件的真实原因"""

import zipfile
from pathlib import Path
from collections import defaultdict

file_path = Path(r"c:\Users\XXK\Desktop\work\excel tools\excel-tools\test\华锐捷.xlsx")

if not file_path.exists():
    print(f"❌ 文件不存在: {file_path}")
    exit(1)

file_size_mb = file_path.stat().st_size / (1024 * 1024)
print(f"\n📊 文件分析: {file_path.name}")
print(f"   大小: {file_size_mb:.2f} MB ({file_path.stat().st_size / 1024:.0f} KB)\n")

print("=" * 70)
print("1️⃣  ZIP 内部文件占用情况 (按大小排序)")
print("=" * 70)

categories = defaultdict(lambda: {"files": [], "size": 0})

with zipfile.ZipFile(file_path, 'r') as zf:
    total_uncompressed = 0
    
    for info in sorted(zf.infolist(), key=lambda x: x.file_size, reverse=True):
        uncompressed_size = info.file_size
        total_uncompressed += uncompressed_size
        
        # 分类
        if "worksheets/sheet" in info.filename:
            cat = "Sheet 数据 XML"
        elif "drawing" in info.filename.lower() or "media" in info.filename.lower():
            cat = "图片/媒体"
        elif "styles.xml" in info.filename:
            cat = "样式表"
        elif "sharedStrings" in info.filename:
            cat = "共享字符串"
        elif "theme" in info.filename:
            cat = "主题"
        elif "chart" in info.filename.lower():
            cat = "图表"
        else:
            cat = "其他"
        
        categories[cat]["files"].append({
            "name": info.filename,
            "size_kb": uncompressed_size / 1024,
            "size_bytes": uncompressed_size
        })
        categories[cat]["size"] += uncompressed_size
    
    # 按总大小排序分类
    for cat_name in sorted(categories.keys(), key=lambda x: categories[x]["size"], reverse=True):
        cat_data = categories[cat_name]
        total_kb = cat_data["size"] / 1024
        pct = 100 * cat_data["size"] / total_uncompressed
        print(f"\n📁 {cat_name}: {total_kb:.1f} KB ({pct:.1f}%)")
        
        for f in sorted(cat_data["files"], key=lambda x: x["size_bytes"], reverse=True)[:5]:
            print(f"   ├─ {Path(f['name']).name}: {f['size_kb']:.1f} KB")
        
        if len(cat_data["files"]) > 5:
            print(f"   └─ ... 还有 {len(cat_data['files'])-5} 个文件")

print("\n" + "=" * 70)
print("2️⃣  Sheet 文件大小详细对比")
print("=" * 70)

with zipfile.ZipFile(file_path, 'r') as zf:
    sheet_sizes = []
    for info in zf.infolist():
        if "worksheets/sheet" in info.filename and info.filename.endswith(".xml"):
            sheet_name = Path(info.filename).stem
            size_kb = info.file_size / 1024
            sheet_sizes.append((sheet_name, size_kb, info.file_size))
    
    if sheet_sizes:
        sheet_sizes.sort(key=lambda x: x[2], reverse=True)
        total_sheet_size = sum(x[2] for x in sheet_sizes)
        
        print(f"\n总 Sheet 数据: {total_sheet_size / 1024:.1f} KB ({total_sheet_size / 1024 / 1024:.2f} MB)\n")
        
        for sheet_name, size_kb, size_bytes in sheet_sizes:
            pct = 100 * size_bytes / total_sheet_size
            print(f"   {sheet_name:20s}: {size_kb:8.1f} KB ({pct:5.1f}%)")

print("\n" + "=" * 70)
print("3️⃣  可能的问题诊断")
print("=" * 70)

with zipfile.ZipFile(file_path, 'r') as zf:
    sheet_xml_size = sum(info.file_size for info in zf.infolist() 
                        if "worksheets/sheet" in info.filename)
    media_size = sum(info.file_size for info in zf.infolist() 
                    if "media" in info.filename.lower())
    
    issues = []
    
    if media_size > 500 * 1024:
        issues.append(f"⚠️  图片/媒体文件过大: {media_size / 1024:.0f} KB")
    
    if sheet_xml_size > 2 * 1024 * 1024:
        issues.append(f"⚠️  Sheet 数据 XML 过大: {sheet_xml_size / 1024 / 1024:.1f} MB")
    
    if sheet_xml_size > 500 * 1024 and len(sheet_sizes) <= 3:
        issues.append(f"⚠️  Sheet 数据过大但数据量不多，可能有大量空白/重复")
    
    if file_size_mb > 10:
        issues.append(f"⚠️  文件总大小 > 10MB: {file_size_mb:.2f} MB")
    
    if issues:
        print()
        for issue in issues:
            print(issue)
        print("\n💡 建议:")
        print("   • 检查是否有隐藏图表/图形")
        print("   • 尝试清除未使用区域 (删除空白行列后保存)")
        print("   • 检查是否有大量格式化但未使用的单元格")
        print("   • 尝试用 LibreOffice 打开并重新保存压缩")
    else:
        print("\n✅ 文件结构相对正常")

print("\n")
