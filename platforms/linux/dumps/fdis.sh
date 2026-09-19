#!/bin/bash
# Function-scoped disassembly: resolve symbol -> (addr,size) from ELF symtab,
# then disassemble exactly that byte range. Avoids linear-sweep desync.
# usage: fdis.sh <elf> <symbol-substring-or-0xADDR> [demangle-match-index]
ELF="$1"; SYM="$2"; IDX="${3:-1}"

if [[ "$SYM" == 0x* ]]; then
  ADDR=$((SYM))
  # find containing symbol size
  read -r SZ NAME < <(readelf -sW "$ELF" | awk -v a="$ADDR" '
    $4=="FUNC" {va=strtonum("0x" $2); sz=$3+0; if (a>=va && a<va+sz) {print sz, $8; exit}}')
  [ -z "$SZ" ] && { echo "no FUNC symbol covers $SYM; refusing linear sweep"; exit 1; }
  START=$ADDR
else
  # match against demangled names
  MATCH=$(readelf -sWC "$ELF" | grep -F "$SYM" | awk '$4=="FUNC" && $3+0>0' | sed -n "${IDX}p")
  [ -z "$MATCH" ] && { echo "symbol not found: $SYM"; exit 1; }
  START=$((0x$(echo "$MATCH" | awk '{print $2}')))
  SZ=$(echo "$MATCH" | awk '{print $3}')
  echo "### $(echo "$MATCH" | cut -d' ' -f9-)" >&2
fi
END=$((START + SZ))
printf "### range 0x%x - 0x%x (%d bytes)\n" "$START" "$END" "$SZ" >&2
objdump -d --start-address=$START --stop-address=$END \
  -M intel --no-show-raw-insn -C "$ELF" 2>/dev/null | sed -n '/>:/,$p'
