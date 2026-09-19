#!/bin/bash
# Disassemble a set of functions FUNCTION-SCOPED (symbol boundaries from .symtab).
# Never a linear sweep: each function is emitted as its own bounded objdump range.
# usage: bulkdis.sh <elf> <regex-over-demangled-names> <outfile>
ELF="$1"; RE="$2"; OUT="$3"
: > "$OUT"
readelf -sWC "$ELF" 2>/dev/null \
 | awk '$4=="FUNC" && $3+0>0 {addr=$2; sz=$3; $1=$2=$3=$4=$5=$6=$7=""; sub(/^ +/,""); print addr"\t"sz"\t"$0}' \
 | sort -u \
 | grep -E "$RE" \
 | while IFS=$'\t' read -r addr sz name; do
     printf '\n########## 0x%s  (%s bytes)  %s\n' "$addr" "$sz" "$name" >> "$OUT"
     objdump -d --start-address=0x$addr --stop-address=$((0x$addr + sz)) \
       -M intel --no-show-raw-insn -C "$ELF" 2>/dev/null | sed -n '/>:/,$p' >> "$OUT"
   done
grep -c '^##########' "$OUT"
