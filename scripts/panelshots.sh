#!/usr/bin/env bash
# Every schematic panel at 2x, from the dev server given as $1.
set -u
U=${1:-http://localhost:5301}/app/
S=${2:-$HOME/.cache/vs-spike/shots/final}
mkdir -p "$S"
MIX='cfbMix:0.6,cfbGain:1.3,cfbFilterMHz:2,cfbFilterBoost:0.8,cfbKey:0.5,cfbRing:0.4'
DEC='demodMHz:0.3,combMode:2,burstLock:0.6,killThresh:12,encChromaMHz:2,chromaTail:0.3,afpcLagLines:20,vir:0.5'
CG='cgMix:1,cgRomAddr:3,cgRomCross:7,cgRomData:-4,cgPageSlip:0.25,cgRomStride:2'
CC='cc:1,ccRomLineSlip:0.05,ccPageAddr:6,ccRomRot:0.3'
shot() {
  TMPDIR=$HOME/.cache/vs-spike/tmp timeout 150 node "$(dirname "$0")/panelshot.mjs" --dpr=2.0 "$@" 2>&1 |
    grep -E '^wrote|^Error'
}
shot "$U" "$S/mixer-stock.png" 'Mixer feedback' 'Mixer feedback (electrical)'
shot "$U#set=$MIX" "$S/mixer-loop.png" 'Mixer feedback' 'Mixer feedback (electrical)'
shot "$U#set=$MIX" "$S/mixer-open.png" 'Mixer feedback' 'Mixer feedback (electrical)' 'resonance'
shot "$U" "$S/decoder-stock.png" 'Receiver' 'Decoder'
shot "$U#set=$DEC" "$S/decoder-bent.png" 'Receiver' 'Decoder'
shot "$U#set=$DEC" "$S/decoder-open.png" 'Receiver' 'Decoder' 'demod'
shot "$U#set=$CG" "$S/chyron-bent.png" 'Mix' 'Character generator (chyron)'
shot "$U#set=$CG" "$S/chyron-open.png" 'Mix' 'Character generator (chyron)' 'address bus'
shot "$U#set=$CC" "$S/captions-bent.png" 'Receiver' 'Captions'
