#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
POSTS_DIR="$PROJECT_ROOT/frontend/public/posts"
IMAGES_DIR="$PROJECT_ROOT/frontend/public/images"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MOVED_COUNT=0
UPDATED_COUNT=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Image Organization Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

update_markdown_references() {
    local post_file="$1"
    local img_name="$2"
    local new_image_path="$3"
    local old_path="$4"
    
    local temp_file
    temp_file=$(mktemp)
    local changed=false
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        local new_line="$line"
        
        if [[ "$new_line" == *"$img_name"* ]] && [[ "$new_line" == *"!["* ]]; then
            if [[ "$new_line" == *"/images/"*"$img_name"* ]]; then
                :
            elif [[ -n "$old_path" ]] && [[ "$new_line" == *"($old_path)"* ]]; then
                new_line="${new_line//"($old_path)"/"(/images/$new_image_path/$img_name)"}"
                changed=true
            elif [[ "$new_line" == *"($img_name)"* ]]; then
                new_line="${new_line//"($img_name)"/"(/images/$new_image_path/$img_name)"}"
                changed=true
            elif [[ "$new_line" == *"(./$img_name)"* ]]; then
                new_line="${new_line//"(./$img_name)"/"(/images/$new_image_path/$img_name)"}"
                changed=true
            fi
        fi
        
        echo "$new_line" >> "$temp_file"
    done < "$post_file"
    
    if [[ "$changed" == true ]]; then
        mv "$temp_file" "$post_file"
        echo -e "${BLUE}    Updated references in: $(basename "$post_file")${NC}"
        UPDATED_COUNT=$((UPDATED_COUNT + 1))
    else
        rm -f "$temp_file"
    fi
}

process_year_directory() {
    local year_dir="$1"
    local year_name
    year_name=$(basename "$year_dir")
    
    if [[ ! "$year_name" =~ ^[0-9]{4}$ ]]; then
        return 0
    fi
    
    local lang_prefix=""
    if [[ "$year_dir" =~ /posts/(ko|en)/ ]]; then
        lang_prefix=$(echo "$year_dir" | grep -oP '/posts/\K(ko|en)(?=/)' || echo "")
        if [[ -n "$lang_prefix" ]]; then
            lang_prefix="${lang_prefix}/"
        fi
    fi

    local image_subdir="$year_dir/image"
    if [[ -d "$image_subdir" ]]; then
        echo -e "${BLUE}Processing: $year_dir/image/${NC}"
        
        for post_img_dir in "$image_subdir"/*/; do
            if [[ -d "$post_img_dir" ]]; then
                local post_name
                post_name=$(basename "$post_img_dir")
                local matching_post="$year_dir/${post_name}.md"
                
                if [[ ! -f "$matching_post" ]]; then
                    echo -e "${YELLOW}  Skip (no matching post): $post_name${NC}"
                    continue
                fi
                
                local target_image_dir="$IMAGES_DIR/${lang_prefix}${year_name}/${post_name}"
                mkdir -p "$target_image_dir"
                
                shopt -s nullglob
                local img_files=("$post_img_dir"/*.png "$post_img_dir"/*.jpg "$post_img_dir"/*.jpeg "$post_img_dir"/*.gif "$post_img_dir"/*.webp "$post_img_dir"/*.svg "$post_img_dir"/*.PNG "$post_img_dir"/*.JPG "$post_img_dir"/*.JPEG "$post_img_dir"/*.GIF "$post_img_dir"/*.WEBP "$post_img_dir"/*.SVG)
                shopt -u nullglob
                
                for img_file in "${img_files[@]}"; do
                    if [[ -f "$img_file" ]]; then
                        local img_name
                        img_name=$(basename "$img_file")
                        
                        if [[ ! -f "$target_image_dir/$img_name" ]]; then
                            mv "$img_file" "$target_image_dir/"
                            echo -e "${GREEN}  Moved: image/$post_name/$img_name -> images/${lang_prefix}${year_name}/${post_name}/${NC}"
                            MOVED_COUNT=$((MOVED_COUNT + 1))
                            
                            local old_ref="image/${post_name}/${img_name}"
                            update_markdown_references "$matching_post" "$img_name" "${lang_prefix}${year_name}/${post_name}" "$old_ref"
                        else
                            echo -e "${YELLOW}  Skip (exists): $img_name${NC}"
                            rm -f "$img_file"
                        fi
                    fi
                done
                
                rmdir "$post_img_dir" 2>/dev/null || true
            fi
        done
        
        rmdir "$image_subdir" 2>/dev/null || true
    fi

    shopt -s nullglob
    local img_files=("$year_dir"/*.png "$year_dir"/*.jpg "$year_dir"/*.jpeg "$year_dir"/*.gif "$year_dir"/*.webp "$year_dir"/*.svg "$year_dir"/*.PNG "$year_dir"/*.JPG "$year_dir"/*.JPEG "$year_dir"/*.GIF "$year_dir"/*.WEBP "$year_dir"/*.SVG)
    shopt -u nullglob
    
    for img_file in "${img_files[@]}"; do
        if [[ -f "$img_file" ]]; then
            local img_name
            img_name=$(basename "$img_file")
            
            local ref_post=""
            shopt -s nullglob
            local md_files=("$year_dir"/*.md)
            shopt -u nullglob
            
            for md_file in "${md_files[@]}"; do
                if [[ "$(basename "$md_file")" == "_index.md" ]]; then
                    continue
                fi
                if grep -q "$img_name" "$md_file" 2>/dev/null; then
                    ref_post="$md_file"
                    break
                fi
            done
            
            if [[ -z "$ref_post" ]]; then
                echo -e "${YELLOW}  Skip (no reference found): $img_name${NC}"
                continue
            fi
            
            local post_name
            post_name=$(basename "$ref_post" .md)
            local target_image_dir="$IMAGES_DIR/${lang_prefix}${year_name}/${post_name}"
            
            mkdir -p "$target_image_dir"
            
            if [[ ! -f "$target_image_dir/$img_name" ]]; then
                mv "$img_file" "$target_image_dir/"
                echo -e "${GREEN}  Moved: $img_name -> images/${lang_prefix}${year_name}/${post_name}/${NC}"
                MOVED_COUNT=$((MOVED_COUNT + 1))
                
                update_markdown_references "$ref_post" "$img_name" "${lang_prefix}${year_name}/${post_name}" "$img_name"
            else
                echo -e "${YELLOW}  Skip (exists): $img_name${NC}"
                rm -f "$img_file"
            fi
        fi
    done

    shopt -s nullglob
    local subdirs=("$year_dir"/*/)
    shopt -u nullglob
    
    for subdir in "${subdirs[@]}"; do
        if [[ -d "$subdir" ]]; then
            local subdir_name
            subdir_name=$(basename "$subdir")
            
            if [[ "$subdir_name" == "image" ]] || [[ "$subdir_name" =~ ^[0-9]{4}$ ]] || [[ "$subdir_name" == "ko" ]] || [[ "$subdir_name" == "en" ]]; then
                continue
            fi
            
            local matching_post="$year_dir/${subdir_name}.md"
            if [[ ! -f "$matching_post" ]]; then
                continue
            fi
            
            local post_name="$subdir_name"
            local target_image_dir="$IMAGES_DIR/${lang_prefix}${year_name}/${post_name}"
            
            shopt -s nullglob
            local subdir_imgs=("$subdir"/*.png "$subdir"/*.jpg "$subdir"/*.jpeg "$subdir"/*.gif "$subdir"/*.webp "$subdir"/*.svg "$subdir"/*.PNG "$subdir"/*.JPG "$subdir"/*.JPEG "$subdir"/*.GIF "$subdir"/*.WEBP "$subdir"/*.SVG)
            shopt -u nullglob
            
            for img_file in "${subdir_imgs[@]}"; do
                if [[ -f "$img_file" ]]; then
                    local img_name
                    img_name=$(basename "$img_file")
                    
                    mkdir -p "$target_image_dir"
                    
                    if [[ ! -f "$target_image_dir/$img_name" ]]; then
                        mv "$img_file" "$target_image_dir/"
                        echo -e "${GREEN}  Moved: $subdir_name/$img_name -> images/${lang_prefix}${year_name}/${post_name}/${NC}"
                        MOVED_COUNT=$((MOVED_COUNT + 1))
                        
                        local old_ref="${subdir_name}/${img_name}"
                        update_markdown_references "$matching_post" "$img_name" "${lang_prefix}${year_name}/${post_name}" "$old_ref"
                    fi
                fi
            done
            
            rmdir "$subdir" 2>/dev/null || true
        fi
    done
}

echo -e "${BLUE}Scanning posts directory...${NC}"
echo ""

for year_dir in "$POSTS_DIR"/*/; do
    if [[ -d "$year_dir" ]]; then
        local_dir_name=$(basename "$year_dir")
        if [[ "$local_dir_name" =~ ^[0-9]{4}$ ]]; then
            process_year_directory "$year_dir"
        elif [[ "$local_dir_name" == "ko" ]] || [[ "$local_dir_name" == "en" ]]; then
            for lang_year_dir in "$year_dir"*/; do
                if [[ -d "$lang_year_dir" ]]; then
                    process_year_directory "$lang_year_dir"
                fi
            done
        fi
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  Images moved: ${MOVED_COUNT}"
echo -e "  Files updated: ${UPDATED_COUNT}"
echo ""
