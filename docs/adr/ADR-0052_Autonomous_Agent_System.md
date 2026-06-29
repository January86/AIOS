# ADR-0052 — Autonomous Agent System (AAS)
**Status:** Accepted  
**Date:** 2026-06-29  
**Author:** AIOS Chief Architect  
**Scope:** Agent orchestration, autonomy, deliberation, safety, dan ethics  
**Tag:** v2.3.0-planning

---

## 1. Konteks

AIOS saat ini memiliki dua agent pasif (Aria dan Nova) yang bekerja berdasarkan rule-based logic. Founder ingin mengembangkan AIOS menjadi sistem yang benar-benar autonomous: menerima goal dari founder, mendekomposisi goal menjadi tasks, menjalankan agent pipeline, dan menyelesaikan goal tanpa intervensi manusia kecuali untuk kasus eskalasi.

Dokumen ini mendefinisikan arsitektur, policy, guardrail, model assignment, dan etika kerja seluruh agent dalam AIOS.

---

## 2. Keputusan

AIOS akan mengimplementasikan **Goal-Driven Agentic Loop** dengan struktur berikut:

- Founder hanya perlu memberikan goal dalam natural language
- Apex (CEO Agent) mendekomposisi goal dan mengkoordinasikan seluruh agent
- Agent bekerja secara autonomous dalam batas yang telah didefinisikan
- Eskalasi ke founder hanya terjadi pada kondisi yang sudah ditentukan
- Semua aksi tercatat di Memory Engine dan audit log
- Agent belajar dari pattern fix yang berhasil (learning loop)

---

## 3. Arsitektur Agent

### 3.1 Hierarki

```
FOUNDER
  │
  │ set_goal via Telegram dedicated channel atau Dashboard
  ▼
APEX — CEO Agent
  │ Orchestrator utama
  │ Personality: tegas, adil, bertanggung jawab, mementingkan kerja sama tim
  │ Memiliki konteks penuh semua project dan prosedur
  │ Dekomposisi goal → task list
  │ Monitor progress seluruh agent
  │ Tiebreaker deliberasi Rex-Vera
  │ Handle eskalasi ke founder
  │
  ├── SAGE — Research Agent
  │   Gather context, parse logs, analisis pattern, root cause analysis
  │
  ├── REX — Developer Agent
  │   Analisis kode, suggest fix, generate patch proposal
  │   TIDAK pernah eksekusi langsung
  │
  ├── VERA — QA Agent
  │   Audit output Rex sebelum eksekusi
  │   Verify hasil fix setelah eksekusi
  │   Deliberation partner untuk Rex (max 3 iterasi)
  │
  ├── AXEL — DevOps Agent
  │   Execute approved actions: restart, deploy, rollback
  │   Hanya bertindak setelah Policy Engine + Vera approve
  │
  ├── ARIA — Monitoring Agent ← existing, upgraded
  │   Health check, detect anomali, Baron log monitoring
  │   Monitor semua agent lain setiap 5 menit
  │
  └── NOVA — Reporter Agent ← existing, upgraded
      Generate report, kirim Telegram, format output
      Daily report 07:00 WITA
```

### 3.2 Apex Personality

Apex bukan sekedar task executor. Apex memiliki personality yang konsisten:

- **Tegas:** Keputusan dibuat berdasarkan data dan prosedur, tidak ragu-ragu
- **Adil:** Tidak pilih kasih antar agent, evaluasi berdasarkan output quality
- **Bertanggung jawab:** Setiap keputusan Apex harus bisa dipertanggungjawabkan ke founder
- **Tim-oriented:** Prioritaskan kolaborasi, bukan kompetisi antar agent
- **Transparan:** Selalu jelaskan reasoning di setiap keputusan

Apex memiliki konteks penuh tentang semua project (ha-platform, executive-brief, baron-trading) termasuk stack, prosedur, blast radius, dan history. Apex tidak perlu diajarkan ulang per goal.

### 3.3 Agent Learning

Setiap agent belajar dari pattern yang berhasil:

- Successful fix → disimpan ke Memory Engine sebagai `type=SUCCESS`
- Failed attempt → disimpan sebagai `type=FAILURE`
- Sebelum mulai task, agent recall memory yang relevan sebagai context
- Pattern recognition: kalau problem yang sama muncul lagi, agent prioritaskan fix yang sudah proven berhasil
- Apex accumulate knowledge tentang project behavior dan team performance

---

## 4. LLM Model Assignment

### 4.1 Provider: OpenRouter

Semua agent menggunakan **OpenRouter** sebagai single provider:
- Base URL: `https://openrouter.ai/api/v1`
- Single API key untuk semua agent
- OpenAI-compatible SDK
- Auto-failover built-in
- Access ke 300+ model tanpa ganti provider

### 4.2 Assignment per Agent

| Agent | Primary Model | Fallback Model | Alasan |
|-------|--------------|----------------|--------|
| Apex | `moonshot/kimi-k2` | `openai/gpt-oss-120b` | Reasoning terkuat + speed, orchestration & tiebreaker |
| Rex | `openai/gpt-oss-120b` | `deepseek/deepseek-v4-pro` | Coding excellence + speed via OpenRouter |
| Vera | `moonshot/kimi-k2` | `openai/gpt-oss-120b` | Critical reasoning untuk audit dan deliberasi |
| Sage | `openai/gpt-oss-120b` | `qwen/qwen3-32b` | Information synthesis, log parsing, research |
| Axel | `meta-llama/llama-3.3-70b` | `qwen/qwen3-32b` | Execution only, butuh speed bukan deep reasoning |
| Aria | `meta-llama/llama-3.3-70b` | `meta-llama/llama-4-scout` | Health check, simple classification, high frequency |
| Nova | `meta-llama/llama-3.3-70b` | `meta-llama/llama-4-scout` | Report formatting, Telegram output |

### 4.3 Model Scoring Reference

| Model | Reasoning /25 | Coding /20 | Speed /20 | Cost /20 | Reliability /15 | Total |
|-------|--------------|-----------|----------|---------|----------------|-------|
| Kimi K2 | 20 | 19 | 18 | 16 | 13 | **86** |
| GPT OSS 120B | 18 | 17 | 17 | 17 | 14 | **83** |
| DeepSeek V4 Pro | 18 | 19 | 12 | 19 | 13 | **81** |
| Qwen3 32B | 16 | 15 | 19 | 19 | 12 | **81** |
| Llama 3.3 70B | 15 | 15 | 18 | 18 | 13 | **79** |
| Llama 4 Scout | 12 | 13 | 20 | 20 | 12 | **77** |

### 4.4 Estimasi Cost

**~$3-5/bulan** untuk normal usage (3 projects, 5 goals/hari).
**~$30-50/bulan** untuk heavy usage (10x normal).

Cost driver utama bukan Aria (health check tanpa LLM) tapi Rex-Vera deliberation. Prompt caching aktifkan untuk Apex dan Vera untuk hemat 50% pada repeated context.

---

## 5. Goal Input Protocol

### 5.1 Channel

- **Telegram Dedicated Channel:** Group khusus AIOS goals, terpisah dari alert channel
- **Dashboard:** Form structured di Command Center
- Semua pesan di Telegram goal channel otomatis dianggap goal
- Natural language — tidak perlu prefix command atau format khusus

### 5.2 Format Telegram (natural language)

```
Fix ha-platform down sejak tadi, guest tidak bisa chat
Check kenapa balance Baron Akun 3 turun drastis hari ini
Optimize executive brief, generate terlalu lambat
Monitor semua project 24 jam, report setiap 6 jam
```

Optional constraint flags:
```
Fix ha-platform down --max-level L1 --deadline 30m
Check Baron --no-modify --notify-all
Fix executive-brief --dry-run
```

### 5.3 Format Dashboard (JSON)

```json
{
  "title": "string",
  "description": "string",
  "scope": {
    "projects": ["ha-platform", "baron-trading", "executive-brief", "aios"],
    "agents_allowed": ["Sage", "Rex", "Vera", "Axel", "Aria", "Nova"],
    "agents_forbidden": []
  },
  "priority": "low | medium | high | critical",
  "deadline": "30m | 1h | 4h | 24h",
  "constraints": {
    "max_autonomy_level": "L0 | L1 | L2 | L3",
    "forbidden_actions": [],
    "require_approval_before": []
  },
  "success_criteria": "string",
  "escalation": {
    "timeout_minutes": 30,
    "on_timeout": "report_progress_and_pause",
    "on_low_confidence": "pause_and_ask"
  },
  "dry_run": false,
  "notify_progress": false
}
```

### 5.4 Default Constraints

| Parameter | Default | Alasan |
|-----------|---------|--------|
| max_autonomy_level | L1 | Cukup untuk 80% kasus, aman |
| deadline | 1 jam | Prevent infinite loop |
| timeout_escalation | 30 menit | Tanpa progress → alert founder |
| dry_run | false | Langsung eksekusi |
| notify_progress | false | Hanya final result |

### 5.5 Conflicting Goals

Kalau ada dua goal aktif di project yang sama:
- Apex evaluasi priority level kedua goal
- Goal dengan priority lebih tinggi dijalankan dulu
- Goal priority sama → selesaikan yang termudah/tercepat dulu
- Founder di-notify: "Goal X sedang berjalan, Goal Y akan dimulai setelah X selesai"

### 5.6 Goal Rate Limiting

Tidak ada rate limit. Founder jarang memberi goal (fokus di 3 project). Kalau ada banyak goal masuk sekaligus, Apex queue dan prioritize secara otomatis.

---

## 6. Agentic Loop

### 6.1 Standard Flow

```
GOAL RECEIVED
    ↓
Apex: parse goal → validate scope → decompose tasks
Apex: recall memory untuk context project yang relevan
    ↓
T1: Sage → gather context, parse logs, research root cause
    ↓
T2: Rex → analyze → suggest fix → recall SUCCESS memories untuk referensi
    ↓
VERA AUDIT (mandatory untuk semua Rex output)
    ↓ PASS
Policy Engine: evaluate risk → ALLOW/DENY/ESCALATE
    ↓ ALLOW
T3: Axel → execute action
    ↓
VERA VERIFY (post-execution health check)
    ↓ HEALTHY
Nova: generate report → Telegram founder
Memory Engine: store incident + fix + outcome + confidence
LEARNING: update SUCCESS/FAILURE pattern
    ↓
GOAL COMPLETE
```

### 6.2 Loop Termination Conditions

| Kondisi | Action |
|---------|--------|
| Success criteria terpenuhi | Nova report → DONE |
| Max iterations reached (10) | Apex escalate ke founder |
| Confidence < 0.40 | Pause → Telegram founder |
| Error 3x berturut-turut | Halt → Telegram founder |
| Deadline tercapai tanpa resolve | Report progress → Pause |
| Founder tidak respond dalam timeout | Assume REJECT → Halt |

### 6.3 Confidence Thresholds

| Confidence | Action |
|-----------|--------|
| ≥ 0.75 | Auto-proceed |
| 0.60 – 0.74 | Proceed dengan warning di log |
| 0.40 – 0.59 | Pause → Telegram founder untuk approval |
| < 0.40 | REJECT → escalate ke Apex → Telegram founder |

---

## 7. Rex-Vera Deliberation Protocol

### 7.1 Flow

```
Rex: suggest fix (reasoning + confidence + recalled SUCCESS patterns)
    ↓
Vera: review → PASS atau REJECT dengan alasan spesifik
    ↓ REJECT
Rex: revise berdasarkan feedback Vera — iterasi 1
    ↓
Vera: review ulang
    ↓ REJECT lagi
Rex: revise lagi — iterasi 2
    ↓
Vera: review ulang
    ↓ REJECT lagi (iterasi 3 — max)
Apex: masuk sebagai tiebreaker dengan full context
    ↓ masih tidak resolve
Eskalasi ke founder via Telegram
```

### 7.2 Rules

- **Max iterasi deliberation: 3x**
- Rex dan Vera tidak boleh audit output diri sendiri
- Setiap iterasi, full conversation history di-pass sebagai context
- Deliberation context disimpan di Memory Engine sebagai `type=WORKING`
- Working memory auto-expire setelah task selesai atau 24 jam
- Vera SELALU punya veto power
- Apex masuk hanya kalau 3 iterasi gagal resolve
- Vera rejection wajib spesifik — tidak boleh reject tanpa alasan konkret

### 7.3 Vera Rejection Format

```json
{
  "verdict": "REJECT",
  "reason": "Restart Baron saat ada open trade berisiko loss realized",
  "specific_concern": "MT5 bridge menunjukkan 2 open positions di akun 18812",
  "suggested_revision": "Tunggu semua posisi closed sebelum restart",
  "confidence": 0.91,
  "iteration": 1
}
```

---

## 8. Autonomy Levels

| Level | Action | Approval Required |
|-------|--------|-------------------|
| L0 | Read, monitor, health check, alert | Auto |
| L1 | pm2 restart service | Auto (confidence ≥ 0.75) |
| L2 | git pull + restart | Telegram approval founder |
| L3 | Rollback ke commit sebelumnya | Telegram approval founder |
| L4 | Modify code atau config | ALWAYS manual |
| L5 | Delete data, stop Baron trading | FORBIDDEN — tidak pernah autonomous |

### Approval Timeout

| Deadline | Timeout | Default |
|----------|---------|---------|
| < 30 menit | 10 menit | REJECT |
| 30 menit – 4 jam | 30 menit | REJECT |
| > 4 jam | 1 jam | REJECT |

**Default selalu REJECT** — fail-safe, bukan fail-open.

---

## 9. Blast Radius per Project

### Baron Trading System
```
BOLEH: monitor, read logs, alert, analisis pattern, read trade history
TIDAK BOLEH: restart process, modify any Python file, change risk params,
             stop trading, touch MT5 bridge, modify trade_config.py
Alasan: Financial system. Salah aksi = loss nyata dan tidak reversible.
```

### Hospitality Agent Platform
```
BOLEH: health check, restart service (L1), read logs, alert anomali
TIDAK BOLEH: modify DB schema/data, change env config, delete guest data,
             modify WhatsApp webhook, touch client-specific configuration
Alasan: Client hotel aktif. Data sensitif. Reputasi bisnis.
```

### Executive Brief (Ensiklomedia)
```
BOLEH: health check, restart service (L1), read logs, alert anomali
TIDAK BOLEH: send brief ke client/subscriber, modify konten brief,
             touch subscriber data/OPD list, modify delivery config,
             generate dan publish brief tanpa human review
Alasan: Output ke institusi pemerintah. Reputasi tinggi.
        Konten harus diverifikasi manusia sebelum publish.
```

### AIOS Sendiri
```
BOLEH: restart agent yang crash (L1, 1x), clear working memory expired,
       update project health status, store memory records
TIDAK BOLEH: modify Policy Engine rules, change autonomy level definitions,
             modify blast radius rules, delete audit logs,
             change Telegram bot configuration
Alasan: Kalau guardrail bisa dimodifikasi agent, seluruh sistem keamanan jebol.
```

---

## 10. Agent Self-Audit dan Recovery

### 10.1 Agent Crash Recovery

```
Agent crash → Kernel ServiceRegistry detect
    ↓
Event: agent.crashed → Apex notified
    ↓
Apex: auto-restart 1x (L1)
    ↓ berhasil → log recovery → continue
    ↓ gagal
Apex: alert founder via Telegram
     "Aria crashed, auto-restart gagal. Manual intervention required."
    ↓
Memory Engine: store agent failure pattern
```

### 10.2 Rules Self-Audit

- Agent TIDAK BOLEH audit output diri sendiri
- Agent TIDAK BOLEH approve aksi diri sendiri
- Apex TIDAK BOLEH override Policy Engine
- Vera adalah mandatory gate untuk semua Rex output — tidak ada bypass
- Aria monitor semua agent lain setiap 5 menit
- Aria sendiri dimonitor oleh Kernel langsung

---

## 11. Output Contract

Semua agent wajib menggunakan format output standar:

```json
{
  "status": "SUCCESS | FAILED | NEEDS_REVIEW | NEEDS_INPUT | REJECTED",
  "task_id": "TASK-xxx",
  "goal_id": "GOAL-xxx",
  "agent": "Rex",
  "summary": "Ringkasan hasil kerja",
  "data": {},
  "confidence": 0.90,
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "autonomy_level_required": "L0 | L1 | L2 | L3 | L4",
  "action_required": "Deskripsi aksi yang akan dieksekusi",
  "warnings": [],
  "errors": [],
  "sources_used": [],
  "memory_recalled": [],
  "audit_required": true,
  "next_action": "send_to_vera | send_to_axel | escalate | done",
  "deliberation_round": 0
}
```

### Output Rules

- Agent TIDAK BOLEH mengarang data untuk menutup kekosongan input
- Kalau data tidak cukup → status `NEEDS_INPUT`
- Kalau confidence rendah → status `NEEDS_REVIEW`
- Semua warning harus eksplisit
- `next_action` harus selalu diisi
- `memory_recalled` list memory IDs yang dipakai sebagai context

---

## 12. Memory Management

### 12.1 Memory Types

| Type | Digunakan untuk | Expire |
|------|----------------|--------|
| WORKING | Deliberation context, active task state | Task selesai atau 24 jam |
| EPISODIC | Incident history, task completion records | 90 hari |
| FAILURE | Bug records, crash logs, failed fixes | Permanent |
| SUCCESS | Successful fix patterns, resolved incidents | Permanent |
| STRATEGIC | Architecture decisions, policy changes | Permanent |
| PROJECT | Project-specific context (stack, config, prosedur) | Update on change |

### 12.2 Learning Loop

```
Task selesai dengan SUCCESS
    ↓
Memory Engine store: type=SUCCESS, title="{problem}: {fix}", importance=8
    ↓
Next time same/similar problem:
Agent recall SUCCESS memories → prioritize proven fix
    ↓
Confidence boost: kalau fix pernah berhasil → confidence +0.10
```

```
Task selesai dengan FAILURE
    ↓
Memory Engine store: type=FAILURE, title="{problem}: {attempted_fix}", importance=9
    ↓
Next time same/similar problem:
Agent recall FAILURE memories → avoid same approach
    ↓
Confidence penalty: kalau fix pernah gagal → confidence -0.15
```

---

## 13. Etika Kerja Agent

Prinsip ini tidak bisa dioverride oleh apapun, termasuk goal dari founder:

1. **Jangan mengarang data** — kalau tidak tahu, katakan tidak tahu, status NEEDS_INPUT
2. **Jangan sembunyikan error** — semua error harus visible di log dan audit
3. **Jangan eksekusi tanpa approval** untuk aksi L2 ke atas
4. **Jangan modifikasi guardrail** — Policy Engine, blast radius, ADR ini
5. **Jangan touch data sensitif** — client data, financial records, credential
6. **Jangan bypass Vera** — semua Rex output wajib melalui audit
7. **Jangan loop tanpa batas** — selalu ada termination condition
8. **Selalu escalate kalau ragu** — lebih baik tanya daripada salah eksekusi
9. **Transparansi penuh** — founder harus bisa trace setiap keputusan
10. **Fail safe, bukan fail open** — kalau tidak yakin, pilih aksi paling aman
11. **Kerja sama tim** — agent saling support, bukan kompetisi
12. **Belajar dari history** — selalu recall memory sebelum mulai task baru

---

## 14. Risiko dan Mitigasi

| Risiko | Likelihood | Impact | Mitigasi |
|--------|-----------|--------|----------|
| Agent loop infinite | Medium | High | Max 10 iterasi, deadline enforcement |
| False positive restart Baron | Low | Critical | Baron FORBIDDEN dari semua autonomous action |
| Rex-Vera deadlock | Low | Medium | Max 3 iterasi, Apex tiebreaker |
| LLM hallucinate fix | Medium | High | Vera mandatory audit, confidence threshold |
| Memory accumulate stale data | Medium | Low | Working memory auto-expire 24h |
| Agent crash cascade | Low | High | Kernel health check, Apex 1x restart |
| Goal ambiguity misinterpreted | High | Medium | Apex confirm interpretation kalau goal ambigu |
| Approval timeout assumed approve | Low | Critical | Default selalu REJECT |
| OpenRouter outage | Low | Medium | Fallback model chain per agent |
| LLM cost spike | Low | Low | Monitor monthly, alert kalau > $50/bulan |

---

## 15. Implementasi Roadmap

### v2.3.0 — Foundation
- Model Router (OpenRouter integration, model selection per agent)
- Agent base class upgrade (support LLM calls, memory recall)
- Output contract enforcement di semua agent
- Memory WORKING type dengan auto-expire
- Apex personality prompt

### v2.4.0 — New Agents
- Sage (Research Agent)
- Rex (Developer Agent)
- Vera (QA Agent)
- Axel (DevOps Agent)
- Apex (CEO Agent)
- Rex-Vera deliberation protocol

### v2.5.0 — Agentic Loop
- Goal intake via Telegram dedicated channel
- Goal decomposition oleh Apex
- Full pipeline: Sage → Rex → Vera → Axel → Vera verify → Nova
- Loop termination enforcement
- Learning loop (SUCCESS/FAILURE pattern)

### v2.6.0 — Production Hardening
- Blast radius enforcement di Policy Engine
- Audit trail lengkap per goal
- Agent health monitoring oleh Aria
- Cost monitoring dan alerting
- Conflicting goal resolution

---

## 16. Open Questions (Resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | Apex perlu personality? | Ya — tegas, adil, bertanggung jawab, tim-oriented |
| 2 | Kalau Vera over-cautious reject Rex yang benar? | Apex sudah punya full project context, bisa identify dan resolve |
| 3 | Rate limiting untuk goal input? | Tidak perlu — founder jarang beri goal, 3 project saja |
| 4 | Conflicting goals di project yang sama? | Selesaikan yang termudah dulu, notify founder |
| 5 | Agent learning? | Ya — SUCCESS/FAILURE pattern di Memory Engine |

---

## 17. Definition of Done

- [ ] OpenRouter integration dengan model routing per agent
- [ ] Semua agent menggunakan Output Contract standar
- [ ] Apex personality prompt implemented dan consistent
- [ ] Rex-Vera deliberation dengan max 3 iterasi
- [ ] Blast radius enforced di Policy Engine per project
- [ ] Goal intake via Telegram dedicated channel
- [ ] Apex decompose natural language goal → task list
- [ ] Memory WORKING type auto-expire setelah task selesai
- [ ] Learning loop: SUCCESS/FAILURE stored dan recalled
- [ ] Agent crash recovery (1x auto-restart, lalu escalate)
- [ ] Audit log lengkap per goal dan task
- [ ] Cost monitoring aktif, alert kalau > $50/bulan

---

*Dokumen ini adalah living document. Perubahan harus melalui ADR baru.*  
*Tidak ada agent yang boleh memodifikasi dokumen ini secara autonomous.*  
*Last reviewed: 2026-06-29*
