# Save, Load & mode-profile architecture

**R1 proposal, bukan schema yang sudah digunakan.** Current source menyimpan satu Profile v3 di `gridbound.v3` dan membaca backup v2/v1. R1 **tidak boleh** sekadar memasukkan bank Crystal ke setiap snapshot lalu berharap reload tidak menggandakan hadiah.

## 1. Apa yang pemain lihat

Title → Profiles menampilkan hingga **3 Commander profiles** (seed UI limit; bukan account online). Setiap card memiliki nama/avatar, last played, mode terakhir, Story chapter dan Challenge bank Crystal. New/Rename/Export/Delete sebagai aksi jelas; Delete memerlukan preview data terdampak + hold/confirm bukan double-click cepat.

Di setiap Commander:
- **Story:** 3 manual slots +1 rolling autosave; Load preview chapter, active party, Gold/material, playtime, saved build/ruleset.
- **Roguelike:** 3 manual checkpoint bookmarks +1 rolling autosave; satu active reward-eligible run. Load preview runId short, act/node, party3, Run Crystal, eligible/finished/Practice status.
- **Raid:** 3 manual loadout/attempt slots +1 auto; satu active attempt. Load preview party1–6, boss/config, ruleset, reward eligibility.
- Shared bank/relic library tampil di kedua mode Challenge, dengan label **Shared on this Commander**. Bukan account-wide lintas Commander dan tidak terhubung Story slots.

Switch Commander saat run aktif menawarkan **Save & Suspend**, **Abandon**, **Cancel**. Tidak menghapus run hanya karena membuka menu. Switch mode boleh setelah suspension committed. Jika storage blocked, tampilkan mode session-only + export option; jangan pura-pura autosave berhasil.

## 2. Storage boundary

**Target pilihan teknologi:** IndexedDB transaction untuk multi-record atomicity, bukan banyak localStorage keys tanpa transaction. localStorage v3 tetap read-only migration source. Ini keputusan teknis usulan yang harus spike dengan Safari/private/quota behavior sebelum acceptance.

```text
SaveDatabase (draft schema4; ruleset R1 terpisah)
  CommanderManifest [commanderId, activeMode, activeSlotIds, revision]
  Settings [audio, reducedMotion, textScale] — global device preference optional
  StorySlot [commanderId, slotId, storyState, inventory, checkpoint, rulesetId]
  RogueCheckpoint [commanderId, slotId, runId, seed, rngState, node, party, purse]
  RaidSlot [commanderId, slotId, attemptId, normalizedBuild, frozenContract]
  ChallengeWallet [commanderId, bankCrystal, unlockIds, mastery, revision]
  RunLedger [commanderId, runId/attemptId, checkpointSeq, status, configHash]
  Transactions [txnId unique, commanderId, sourceId, amount, receipt, revision]
  Recovery [lastGoodSnapshot, migrationSourceDigest, schema/content versions]
```

Schema version mendeskripsikan format; rulesetId formula/game balance; contentVersion dictionary IDs. Semuanya harus ada dalam header import. Profile name tidak dipakai sebagai key/file path dan selalu escaped di UI.

## 3. Saving protocol

1. Freeze relevant gameplay state pada safe boundary. Validate mode, IDs, quantities, slot count, PRNG state, relationships dan size limits.
2. Acquire writer lease for Commander + compare expected revision (lease alone not enough).
3. Within one DB transaction write checkpoint, ledger status, wallet delta/receipt if any, and manifest revision.
4. Commit result → baru tampilkan **Saved** timestamp dan stable checkpoint. Jika gagal, original lastGood tetap ada, state dirty warning, retry/export.
5. Broadcast revision to other tabs. Tab stale masuk read-only/refresh prompt; jangan last-writer silently overwrite.

Frame-by-frame autosave tidak perlu. Checkpoints: sebelum reveal event/shop/draft, setelah pilihan/pembelian, node terminal, safe camp, mode switch. Victory settlement idempotent jika render dialog membuka/menutup berkali-kali. Settlement terjadi dari outcome event, tidak menunggu claim/Continue click. Result dapat tampil setelah death readiness dengan status Saving; navigation tetap terkunci hingga save receipt committed dan one-second visible lock selesai. Save gagal menjaga pending outcome untuk Retry/export.

### Reload behavior

- Story: manual save boleh rewind Story state, karena tidak memberi bank/reward Challenge atau global first-clear gift. Kemajuan tiap slot independen; player memilih snapshot jelas.
- Rogue: snapshot sebelum node memakai seed/RNG yang sama. RunLedger progression monotonic. Load snapshot lebih tua dari ledger yang telah settled **tidak** mengurangi seq/undo wallet; tawarkan view build / fork Practice no-reward / continue latest. Tidak ada branch snapshot yang menggandakan runId eligible.
- Raid: old loadout bisa dipakai untuk **attempt baru dengan ID baru**; old completed attempt dapat replay Practice, receipt lama tetap spent.
- Crash mid-combat: restore encounter-start snapshot dengan seed/config sama, HP dan supplies dari encounter start; tidak restore reward yang sudah terminal sebagai unclaimed. If terminal transaction committed, return to results/checkpoint, not refight for another receipt.
- Tidak ada exact mid-frame combat save di R1. UI harus mengatakan “resumes from encounter start”, bukan berpura-pura screenshot frame resume.

## 4. Import/export

**Whole Commander export**: manifest + all owned mode slots + wallet/ledger + version metadata, optional settings; user-download JSON. **Mode-only export** hanya state/build tanpa additive wallet. Max uncompressed10MiB proposal, bounded arrays/strings/numbers, reject unknown executable payload/URLs; JSON hanya data.

Import flow: pick file → parse bounded → validate complete envelope → migration preview → list counts/progress/currencies → destination **New Commander** atau explicit replace with pre-import backup → confirm → transaction → readback revision → success. Never merge Crystal balances atau first-clear lists dengan penjumlahan.

Mode-only Rogue import dari Commander berbeda: bisa mengimpor **build preset** atau **Practice snapshot**; tidak memberi rewards dan tidak menghapus unlocks wallet tujuan. Raid preset import menjalani normal budget validator. Unknown/future version protected; show needs compatible app; no drop unknown fields then overwrite source.

**Checksum hanya corruption detection, bukan signature anti-cheat.** Pemilik local files dapat mengubah data; single-player offline tidak menyatakan fairness online. Full backup restore di browser baru bisa mengembalikan progression lama, tetapi tidak dapat dijumlahkan ke Commander lama lewat UI.

## 5. Migration v3 → target

1. Detect v3 secara lengkap dengan validator yang ada; corrupted/incomplete/future data tidak otomatis fresh-save.
2. Prompt **Create R1 copy**; simpan v3 byte-identical + export reminder. Tidak migrate diam-diam saat halaman terbuka.
3. Create Commander default dengan Story slot copy. Gold/material mapping: existing Gold tetap Story; existing gear inventory valid tetap menjadi legacy-owned recipe/template item, no free dismantle payout. Old raids/endless metrics jadi legacy statistics, **bukan bank Crystal**.
4. Named hero IDs, XP, chapter/quest flags, formation (9 slots) dipertahankan. Five-stat growth baru dihitung dari level/class baseline + refund allocated budget; preview memperlihatkan sebelum/sesudah. Old talents/jobs disimpan mapping manifest; unknown paths tidak dibuang—migration blocked atau tetap Classic.
5. Story active cap6 sesuai [D3 approved](APPROVAL-D1-D8.md): original roster9 tetap, sisanya masuk bench; pemain memilih anggota aktif dalam migration preview. Tidak menghapus equipment/XP hero cadangan. Approval cap bukan izin mengubah save pemain sekarang; mapping dan preview tetap wajib sebelum migrasi.
6. Generic old advanced jobs tidak dipetakan ke unique hero path dengan nama asumsi. Mapping table authored per hero/job, skill slots revalidated, semua investasi yang invalid dikembalikan sesuai historical paid provenance, tidak menghasilkan loop refund.
7. Store `migrationId` + source digest dalam target; repeat import same source mengarah ke copy/replace jelas, bukan reward baru. Target fresh ChallengeWallet0; basic jobs playable.
8. Commit R1 copy; opening Classic version membaca v3 lama, tidak menulis schema baru.

**Schema rollback ≠ app rollback.** Deploy asset lama tidak boleh mencoba menormalisasi save R1. Legacy save tetap tersedia; bila user lanjut banyak di R1, returning Classic mengorbankan progress R1 yang belum compatible dan harus dijelaskan. Release drill wajib memakai backup nyata fixture, bukan production user data.

## 6. Required states & UX

Slots: empty, valid, incompatible-version, corrupted/protected, active-checkpoint, terminal-replay, dirty-unsaved. Cloud sync tidak ada di scope; jangan menampilkan status seolah cloud sedang tersedia.

Load/cancel tidak mutate active profile. Dialog warning tidak auto-close; Enter dari file picker tidak confirm overwrite. Focus dikembalikan ke slot button. Save status local time boleh ditampilkan jika waktu sistem tersedia, tetapi transaction order memakai integer revision bukan jam wall-clock.

## 7. Acceptance fixtures

- Zero saves, full slots, rename/delete current, blocked storage, quota, Safari private, two tabs editing, power-loss before/after commit.
- v1/v2/v3 valid, v3 incomplete, schema4 unknown fields, future version, empty arrays, wrong hero/job ID, NaN/Infinity/negative resources, overlength name, HTML/script-looking name, huge import.
- Same receipt twice, same event before/after reveal, old node bookmark, wallet unlock purchase crash, retry after victory render crash, foreign Commander mode import.
- Full export→fresh origin import exact semantic round-trip; restore backup replaces instead of sums wallet; current backup preserved.
- Switching mode cannot heal/refill an active Rogue run or change frozen Raid config.
- Automated validator tests + browser interactions + physical device storage checks needed. Tidak ada yang lulus hanya karena schema di dokumen lengkap.
