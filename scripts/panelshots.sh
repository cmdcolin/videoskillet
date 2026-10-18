#!/usr/bin/env bash
# Every schematic panel at 2x, at stock and bent, from the dev server given as
# $1, into the directory given as $2. Name a few looks after those to shoot
# only the ones whose file names start with them: panelshots.sh <url> <dir> vhs sync
set -u
U=${1:-http://localhost:5301}/app/
S=${2:-$HOME/.cache/vs-spike/shots/final}
shift $(($# < 2 ? $# : 2))
ONLY=("$@")
mkdir -p "$S" "$S/tmp"

CAM='fbMix:0.8,fbGain:1.1,fbZoom:1.05,fbLag:0.4'
MIX='cfbMix:0.6,cfbGain:1.3,cfbFilterMHz:2,cfbFilterBoost:0.8,cfbKey:0.5,cfbRing:0.4'
CG='cgMix:1,cgRomAddr:3,cgRomCross:7,cgRomData:-4,cgPageSlip:0.25,cgRomStride:2'
KEY='bKey:1,bKeyHueDeg:240,bKeyAcceptDeg:40,bKeySoft:0.2,bGenlock:1,bKeyFill:1'
REC='fmOverdev:0.8,fmStreakUs:0.6,lumaPeak:2,diffGain:0.3,diffPhaseDeg:12'
LEAK='ghostDelayUs:4,ghostGain:-0.4,soundIre:4,humAmp:3'
ENH='enhPeakMHz:1.5,enhPeakBoost:2,enhDroopUs:40'
TB='tbWowNs:200,tbJitterNs:40,tbStickNs:300,headSwitchShiftUs:3'
VHS='trackAmt:0.6,trackPos:0.3,trackHunt:0.6,shuttleX:3,headClog:1,colorUnderMix:1'
SYNC='hHold:0.3,hDetuneHz:400,vHold:0.2,vFreqHz:57'
DEFL='hvSagUs:2,hvRing:0.6,abl:0.8,bendUs:1'
DEC='demodMHz:0.3,combMode:2,burstLock:0.6,killThresh:12,encChromaMHz:2,chromaTail:0.3,afpcLagLines:20,vir:0.5'
CC='cc:1,ccRomLineSlip:0.05,ccPageAddr:6,ccRomRot:0.3'
PH='phosphor:0.6,phosphorSkew:0.5,burnRate:1,burnDepth:0.5'

shot() {
  local name=$1
  shift
  if [ ${#ONLY[@]} -gt 0 ]; then
    local hit=
    for o in "${ONLY[@]}"; do [[ $name == "$o"* ]] && hit=1; done
    [ -z "$hit" ] && return
  fi
  TMPDIR=$S/tmp timeout 150 node "$(dirname "$0")/panelshot.mjs" --dpr=2.0 \
    "$1" "$S/$name.png" "${@:2}" 2>&1 | grep -E '^wrote|^Error'
}
pair() {
  local name=$1 set=$2
  shift 2
  shot "$name-stock" "$U" "$@"
  shot "$name-bent" "$U#set=$set" "$@"
}

pair camera "$CAM" 'Camera feedback' 'Camera feedback (optical)'
pair tube "$CAM" 'Camera feedback' 'Tube face (what the camera shoots)'
pair mixer "$MIX" 'Mixer feedback' 'Mixer feedback (electrical)'
shot mixer-open "$U#set=$MIX" 'Mixer feedback' 'Mixer feedback (electrical)' 'resonance'
pair chyron "$CG" 'Mix' 'Character generator (chyron)'
shot chyron-open "$U#set=$CG" 'Mix' 'Character generator (chyron)' 'address bus'
pair key "$KEY" 'Mix' 'Chroma key (A through B)'
pair recording "$REC" 'Channel' 'Recording (luma & FM)'
pair leak "$LEAK" 'Channel' 'Ghosting & leakage'
pair enhancer "$ENH" 'Channel' 'Enhancer (bent)'
pair timebase "$TB" 'Channel' 'Timebase'
pair vhs "$VHS" 'Channel' 'VHS colour & tracking'
pair sync "$SYNC" 'Receiver' 'Sync'
pair deflection "$DEFL" 'Receiver' 'Deflection'
pair decoder "$DEC" 'Receiver' 'Decoder'
shot decoder-open "$U#set=$DEC" 'Receiver' 'Decoder' 'demod'
pair captions "$CC" 'Receiver' 'Captions'
pair phosphor "$PH" 'Screen' 'Phosphor'
