#!/bin/bash
# Smoke test for whcli — all CLI commands must return valid results
# Run: bash tests/smoke-test.sh
# Expects: working auth, network access

PASS=0; FAIL=0; TOTAL=0

check() {
  TOTAL=$((TOTAL+1))
  LABEL="$1"; CMD="$2"; EXPECT="$3"
  OUT=$(eval "$CMD" 2>&1)
  OK=0
  case "$EXPECT" in
    notzero) echo "$OUT" | jq -e '.totalFound > 0' >/dev/null 2>&1 && OK=1 ;;
    items)   echo "$OUT" | jq -e '.items' >/dev/null 2>&1 && OK=1 ;;
    noerror) echo "$OUT" | jq -e '.error' >/dev/null 2>&1 || OK=1 ;;
    text)    echo "$OUT" | grep -q "Treffer" && OK=1 ;;
    hasid)   echo "$OUT" | jq -e '.id' >/dev/null 2>&1 && OK=1 ;;
  esac
  if [ $OK -eq 1 ]; then
    PASS=$((PASS+1)); echo "✅ $LABEL"
  else
    FAIL=$((FAIL+1))
    TF=$(echo "$OUT" | jq '.totalFound // "err"' 2>/dev/null)
    ERR=$(echo "$OUT" | jq -r '.error // empty' 2>/dev/null)
    echo "❌ $LABEL  (found=$TF ${ERR:+err=$ERR})"
  fi
}

TSX="npx tsx src/cli.ts"

echo "=== BASIC SEARCH ==="
check "search basic"                   "$TSX search iphone 2>/dev/null"                              notzero
check "search --text"                  "$TSX search iphone --text 2>&1"                              text
check "search --category"              "$TSX search pixel --category 2722 2>/dev/null"               notzero
check "search --max-price"             "$TSX search iphone --max-price 200 2>/dev/null"              items
check "search --sort price-asc"        "$TSX search iphone --sort price-asc 2>/dev/null"             notzero
check "search --location 900"          "$TSX search iphone --location 900 2>/dev/null"               notzero

echo ""
echo "=== IMMO SEARCH ==="
check "immo alle wien"                 "$TSX search wohnung --vertical immobilien --location 900 2>/dev/null"              notzero
check "immo eigentumswohnung wien"     "$TSX search wohnung --vertical immobilien --type eigentumswohnung --location 900 2>/dev/null"  notzero
check "immo mietwohnung wien"          "$TSX search wohnung --vertical immobilien --type mietwohnung --location 900 2>/dev/null"       notzero
check "immo haus wien"                 "$TSX search haus --vertical immobilien --type haus --location 900 2>/dev/null"                notzero
check "immo haus-kaufen wien"          "$TSX search haus --vertical immobilien --type haus-kaufen --location 900 2>/dev/null"         notzero
check "immo haus-mieten wien"          "$TSX search haus --vertical immobilien --type haus-mieten --location 900 2>/dev/null"         notzero
check "immo haus --max-price 500k"     "$TSX search haus --vertical immobilien --type haus --max-price 500000 --location 900 2>/dev/null" notzero
check "immo haus simmering"            "$TSX search haus --vertical immobilien --type haus --location 117233 2>/dev/null"             notzero
check "immo mietwohnung simmering"     "$TSX search wohnung --vertical immobilien --type mietwohnung --location 117233 2>/dev/null"   notzero
check "immo eigentumswohnung simmering" "$TSX search wohnung --vertical immobilien --type eigentumswohnung --location 117233 2>/dev/null" notzero
check "immo haus favoriten"            "$TSX search haus --vertical immobilien --type haus --location 117232 2>/dev/null"             notzero
check "immo mietwohnung favoriten"     "$TSX search wohnung --vertical immobilien --type mietwohnung --location 117232 2>/dev/null"   notzero

echo ""
echo "=== VEHICLE SEARCH ==="
check "car basic"                      "$TSX car --text 2>&1"                                        text
check "car --max-price 5000"           "$TSX car --max-price 5000 --text 2>&1"                       text
check "moto basic"                     "$TSX moto --text 2>&1"                                       text
check "moto --filter Enduro"           "$TSX moto --filter MC_CATEGORY=Enduro --text 2>&1"           text

echo ""
echo "=== OTHER COMMANDS ==="
check "view adId"                      "$TSX view 761659339 2>/dev/null"                             hasid
check "favorites summary"              "$TSX favorites summary 2>/dev/null"                          noerror
check "auth"                           "$TSX auth 2>/dev/null"                                       noerror

echo ""
echo "═══════════════════════════════════════"
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════"
[ $FAIL -eq 0 ] && exit 0 || exit 1
