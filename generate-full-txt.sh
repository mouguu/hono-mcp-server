#!/bin/bash

# 输出文件
OUTPUT_FILE="full.txt"

# 清空或创建输出文件
> "$OUTPUT_FILE"

# 添加项目信息头部
echo "========================================" >> "$OUTPUT_FILE"
echo "Hono MCP Server - Full Source Code" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "========================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 定义要包含的文件扩展名
EXTENSIONS=("ts" "js" "json" "md" "toml" "gitignore")

# 定义要排除的目录
EXCLUDE_DIRS=("node_modules" ".git" ".wrangler" "dist" "build")

# 函数: 检查路径是否应该被排除
should_exclude() {
    local path="$1"
    for exclude_dir in "${EXCLUDE_DIRS[@]}"; do
        if [[ "$path" == *"/$exclude_dir/"* ]] || [[ "$path" == *"/$exclude_dir" ]]; then
            return 0
        fi
    done
    return 1
}

# 函数: 添加文件内容到输出
add_file_content() {
    local file="$1"
    local relative_path="${file#./}"
    
    echo "" >> "$OUTPUT_FILE"
    echo "========================================" >> "$OUTPUT_FILE"
    echo "File: $relative_path" >> "$OUTPUT_FILE"
    echo "========================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}

# 遍历并处理文件
echo "正在收集源代码文件..."

# 处理特定的配置文件
for file in package.json tsconfig.json wrangler.toml README.md .gitignore; do
    if [ -f "$file" ]; then
        echo "添加: $file"
        add_file_content "$file"
    fi
done

# 处理 src 目录下的所有文件
if [ -d "src" ]; then
    while IFS= read -r -d '' file; do
        if ! should_exclude "$file"; then
            echo "添加: $file"
            add_file_content "$file"
        fi
    done < <(find src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.json" \) -print0)
fi

echo "" >> "$OUTPUT_FILE"
echo "========================================" >> "$OUTPUT_FILE"
echo "End of Full Source Code" >> "$OUTPUT_FILE"
echo "========================================" >> "$OUTPUT_FILE"

echo "✅ 完成! 所有源代码已输出到 $OUTPUT_FILE"
echo "📊 文件大小: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo "📝 总行数: $(wc -l < "$OUTPUT_FILE")"
