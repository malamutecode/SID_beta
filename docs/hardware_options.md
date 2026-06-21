# Document Classification — Hardware Options

**Deployment options for the local AI document-classification solution**

_Prepared for client review · June 2026 · Confidential_

> **Uwaga dot. cen:** Wszystkie ceny podane w tym dokumencie są cenami **netto** (bez podatku VAT).

The solution runs a **local AI model** to read and classify documents (PDFs, scans, and images) entirely on the customer's own hardware — no cloud, no data leaving the premises. Because all processing is local, the choice of hardware determines speed, the size of model that can run, and the deployment form factor.

This document presents **four on-premises hardware options** — from a budget GPU upgrade to an all-in-one mini-PC — so the client can match capability, footprint, and budget. A key technical factor is the **AI model size** the hardware can host: the larger the model, the higher the classification accuracy on difficult or scanned documents — and the more memory the hardware needs.

---

## On-premises options at a glance

All options are **on-premises (on-prem)** — the AI runs entirely on hardware the client owns and controls; no cloud, no data leaving the premises. **All prices are net (netto, excl. VAT).**

| Option | Platform | AI model it can run | Form factor & power | Indicative price (netto) |
|--------|----------|---------------------|---------------------|--------------------------|
| **1. Radeon RX 9070** | AMD Radeon RX 9070 (16 GB) in an existing or new machine | Qwen 3 VL 8B (runs comfortably on 16 GB) | GPU only (existing machine) or complete new build | ~2 000 zł netto (GPU only) / ~5 500 zł netto (full system) |
| **2. RTX 5060 8 GB** | NVIDIA RTX 5060 8 GB in an existing workstation | Smaller 8B Qwen vision model (8 GB VRAM) | Standard workstation; lowest power draw | ~1 250 zł netto (GPU only) / ~4 000 zł netto (full system) |
| **3. RTX 5070 Ti 16 GB** | NVIDIA RTX 5070 Ti (16 GB) in an existing or new machine | Qwen 3 VL 8B and larger models; headroom for future upgrades | GPU only (existing machine) or complete new build | ~4 000 zł netto (GPU only) / ~7 500 zł netto (full system) |
| **4. AMD Ryzen AI Max+ 395** | Mini-PC APU (up to 128 GB unified memory) | 8B vision model and substantially larger models | Small-form-factor PC; moderate power, no server needed | ~14 000 zł netto (full system) |

---

## The options in detail

### Option 1 · Mid-range GPU — AMD Radeon RX 9070

_16 GB discrete GPU — drop-in upgrade or basis for a new build_

- **16 GB VRAM** — runs **Qwen 3 VL 8B** comfortably with room to spare.
- Can be inserted into an **existing workstation** — GPU only (~2 000 zł netto).
- Alternatively, build a **complete new machine** around it (~5 500 zł netto full system).
- _Trade-off:_ AMD GPU — verify LM Studio driver compatibility before ordering.

**Price: ~2 000 zł netto (GPU) / ~5 500 zł netto (full build)**

---

### Option 2 · Budget GPU — NVIDIA RTX 5060 8 GB

_8 GB discrete GPU — lowest-cost entry point_

- Lowest up-front GPU cost of all options.
- Runs the smaller 8B Qwen vision model within its 8 GB VRAM budget.
- Drop-in upgrade to any existing workstation with a free PCIe slot.
- Alternatively, build a **complete new machine** around it (~4 000 zł netto full system).
- _Trade-off:_ 8 GB limits model choice; no headroom for larger models.

**Price: ~1 250 zł netto (GPU only) / ~4 000 zł netto (full build)**

---

### Option 3 · Future-proof GPU — NVIDIA RTX 5070 Ti 16 GB

_16 GB GDDR7 discrete GPU — high-performance, forward-looking choice_

- **16 GB GDDR7 VRAM** — runs **Qwen 3 VL 8B** comfortably with ample headroom for larger, more accurate models in the future.
- NVIDIA CUDA ecosystem: best software compatibility with LM Studio, no driver concerns.
- Can be inserted into an **existing workstation** — GPU only (~4 000 zł netto).
- Alternatively, build a **complete new machine** around it (~7 500 zł netto full system).
- Noticeably faster inference than the RX 9070 thanks to newer architecture and higher memory bandwidth.
- _Trade-off:_ higher GPU cost than Option 1, but buys significantly more performance and future runway.

**Price: ~4 000 zł netto (GPU only) / ~7 500 zł netto (full build)**

---

### Option 4 · Edge / All-in-one — AMD Ryzen AI Max+ 395

_Mini-PC APU with up to 128 GB unified memory (Strix Halo)_

- Up to **128 GB unified memory** shared with the GPU — runs the 8B vision model comfortably, and far larger models if higher accuracy is wanted.
- Delivers near-workstation capability in a **small mini-PC** — no server chassis, no discrete GPU, moderate power.
- Self-contained edge box: full capability on-premises without a server room.
- _Trade-off:_ highest up-front cost of the four, as a complete system.

**Price: ~14 000 zł netto (full system)**

---

## A note on model size & accuracy

The hardware's memory caps the size of AI model it can host, and model size is the main lever on classification quality. **Options 1, 3, and 4 run the validated 8B vision model** — the configuration that reads both digital text and scanned/image documents reliably (4/4 correct in our proof-of-concept). Option 2 (RTX 5060, 8 GB) also runs an 8B Qwen vision model but with no memory headroom left. The RX 9070 (16 GB), RTX 5070 Ti (16 GB), and 128 GB Ryzen all leave room for larger, longer-context models should higher accuracy be required later — with the RTX 5070 Ti offering the best performance-per-zloty at the 16 GB tier.

---

## Performance reference

Measured with the 8B vision model on an 8 GB NVIDIA GPU (comparable to the RTX 5060 budget option; the RX 9070, RTX 5070 Ti, and Ryzen would be equal or faster):

| Document | Type | Time | Result |
|----------|------|------|--------|
| 2-page form | Digital text | ~6 s | Correct |
| 3-page tax form | Digital text | ~6 s | Correct |
| 4-page tax form | Digital text | ~5–6 s | Correct |
| Scanned document | Image (AI reads the scan) | ~5 s/page | Correct |

A few seconds per document, all classified correctly. Digital-text documents are fast regardless of length; **scanned documents cost more per page** because the AI reads each page as an image.

---

## Recommendation

**Budget upgrade (Option 2 — RTX 5060 8 GB, ~1 250 zł netto):** the cheapest way to add local AI classification to an existing workstation. Works with the smaller Qwen vision model at 8 GB; no headroom for larger models.

**Best value (Option 1 — Radeon RX 9070, ~2 000 zł netto GPU / ~5 500 zł netto full build):** drop a 16 GB card into an existing workstation and run Qwen 3 VL 8B comfortably. If a new machine is also needed, the full build comes to ~5 500 zł netto.

**Most future-proof GPU (Option 3 — RTX 5070 Ti, ~4 000 zł netto GPU / ~7 500 zł netto full build):** NVIDIA's latest architecture with 16 GB GDDR7 — faster than the RX 9070, guaranteed CUDA compatibility, and the most headroom for future model upgrades at the GPU tier. Recommended when the investment horizon is 3–5 years or larger models may be needed.

**All-in-one, no server (Option 4 — Ryzen AI Max+ 395, ~14 000 zł netto):** a single self-contained box with the most memory headroom, ideal where a server room is not available or the largest models may be wanted later.

---

_All options are on-premises; the AI runs entirely on client-owned hardware with no cloud dependency. **All prices are net (netto) — VAT not included.** Prices are indicative hardware estimates and vary with retailer and configuration. Performance figures are from the project's measured test run and are representative, not a contractual benchmark. Accuracy figures reflect a small proof-of-concept sample and should be re-validated on a larger, client-specific document set._