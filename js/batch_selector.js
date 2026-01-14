// Developed by 3R3BOS
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "3R3BOS.BatchSelector",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "Batch Selector (3R3BOS)") return;

        // --- NATIVE CANVAS IMPLEMENTATION V3 (CLASSY / SOBER) ---
        // Style Reference: Image Comparer Slider (Dark Grays, White Accents, No Neon)

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) onNodeCreated.apply(this, arguments);

            this.images = [];
            this.selectedIndices = new Set();
            this.imagePaths = [];

            // Buttons State
            this.buttons = {
                all: { text: "ALL", hover: false },
                none: { text: "NONE", hover: false },
                cancel: { text: "CANCEL", hover: false },
                confirm: { text: "CONFIRM", hover: false }
            };
        };

        const onDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            if (onDrawForeground) onDrawForeground.apply(this, arguments);

            if (!this.imagePaths.length) {
                // Placeholder - Elegant Font
                ctx.fillStyle = "#888";
                ctx.font = "italic 13px 'Segoe UI', Roboto, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("Waiting for batch...", this.size[0] / 2, this.size[1] / 2);
                return;
            }

            // Layout Constants
            const margin = 12; // More breathing room
            const topBarH = 10;
            const bottomBarH = 45; // Slightly taller for elegant buttons
            const contentX = margin;
            const contentY = topBarH;
            const contentW = this.size[0] - (margin * 2);
            const contentH = this.size[1] - topBarH - bottomBarH - margin;

            // Grid Calc
            const count = this.imagePaths.length;
            const approxSide = Math.sqrt((contentW * contentH) / count);
            let cols = Math.floor(contentW / approxSide);
            if (cols < 1) cols = 1;
            const rows = Math.ceil(count / cols);

            const cellW = (contentW - (margin * (cols - 1))) / cols;
            const cellH = (contentH - (margin * (rows - 1))) / rows;

            this.imageRects = [];

            this.imagePaths.forEach((path, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);

                const x = contentX + (col * (cellW + margin));
                const y = contentY + (row * (cellH + margin));

                this.imageRects.push({ i, x, y, w: cellW, h: cellH });

                // Clip Container
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(x, y, cellW, cellH, 6); // Smoother radius
                ctx.clip();

                // Background (Darker/Sober)
                ctx.fillStyle = "#151515";
                ctx.fillRect(x, y, cellW, cellH);

                // Image Render
                const img = this.images[i];
                if (img && img.complete && img.width > 0) {
                    const imgRatio = img.width / img.height;
                    const cellRatio = cellW / cellH;
                    let sx, sy, sw, sh;

                    if (imgRatio > cellRatio) {
                        sh = img.height;
                        sw = img.height * cellRatio;
                        sy = 0;
                        sx = (img.width - sw) / 2;
                    } else {
                        sw = img.width;
                        sh = img.width / cellRatio;
                        sx = 0;
                        sy = (img.height - sh) / 2;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, x, y, cellW, cellH);
                }
                ctx.restore();

                // Selection Overlay (CLASSY STYLE)
                if (this.selectedIndices.has(i)) {
                    // Border: White, Thin, Elegant
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#e0e0e0";
                    ctx.strokeRect(x, y, cellW, cellH);

                    // Subtle outer glow/shadow for separation
                    // ctx.shadowColor = "black"; ctx.shadowBlur = 4;

                    // Checkmark Badge: Minimalist Square or Circle in corner
                    const badgeSize = 20;
                    const bx = x + cellW - badgeSize - 6;
                    const by = y + 6;

                    ctx.beginPath();
                    ctx.roundRect(bx, by, badgeSize, badgeSize, 4);
                    ctx.fillStyle = "#e0e0e0"; // Classy Light Gray
                    ctx.fill();

                    ctx.fillStyle = "#111"; // Dark Text
                    ctx.font = "bold 12px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("✓", bx + badgeSize / 2, by + badgeSize / 2 + 1);
                } else {
                    // Unselected: Slight dimmed border or nothing?
                    // Let's do nothing for maximum cleanness, or a very faint border
                    // ctx.strokeStyle = "#222"; ctx.lineWidth=1; ctx.strokeRect(x,y,cellW,cellH);
                }
            });

            // Buttons (Footer) - SOBER STYLE
            const btnGap = 8;
            const totalBtnW = this.size[0] - (margin * 2);
            const unit = (totalBtnW - (btnGap * 3)) / 6;

            // Palette: Derived from Image Slider (#353535 bg, #eee text)
            // Pressed/Action buttons get a bit more highlight but keep it monochrome/muted.
            const btnSpecs = [
                { key: 'all', w: unit, bg: "#252525", hoverBg: "#353535", text: "#888", hoverText: "#fff" },
                { key: 'none', w: unit, bg: "#252525", hoverBg: "#353535", text: "#888", hoverText: "#fff" },
                // Cancel: Dark Red tint or just Dark? Let's go Dark w/ Red Accent Text
                // Confirm: Dark w/ White Text or subtle Primary
                { key: 'cancel', w: unit * 2, bg: "#252525", hoverBg: "#3a2020", text: "#a55", hoverText: "#f88" },
                { key: 'confirm', w: unit * 2, bg: "#e0e0e0", hoverBg: "#fff", text: "#111", hoverText: "#000" } // Inverted for Primary
            ];

            let cursorX = margin;
            const btnY = this.size[1] - margin - 32;
            const btnH = 32;

            this.btnRects = [];

            btnSpecs.forEach(spec => {
                const btnState = this.buttons[spec.key];
                const x = cursorX;
                this.btnRects.push({ key: spec.key, x, y: btnY, w: spec.w, h: btnH });

                // Button Background
                ctx.fillStyle = btnState.hover ? spec.hoverBg : spec.bg;
                ctx.beginPath();
                ctx.roundRect(x, btnY, spec.w, btnH, 4); // Slightly sharper corners (4px)
                ctx.fill();

                // Border (Subtle)
                ctx.lineWidth = 1;
                ctx.strokeStyle = "#333";
                ctx.stroke();

                // Text
                ctx.fillStyle = btnState.hover ? spec.hoverText : spec.text;
                ctx.font = (spec.key === 'confirm' ? "bold " : "") + "12px 'Segoe UI', Roboto, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(btnState.text, x + spec.w / 2, btnY + btnH / 2);

                cursorX += spec.w + btnGap;
            });
        };

        // 2. Interaction
        const onMouseDown = nodeType.prototype.onMouseDown;
        nodeType.prototype.onMouseDown = function (event, pos, graphPos) {
            if (onMouseDown) onMouseDown.apply(this, arguments);
            const x = pos[0];
            const y = pos[1];

            if (this.imageRects) {
                for (const r of this.imageRects) {
                    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                        if (this.selectedIndices.has(r.i)) this.selectedIndices.delete(r.i);
                        else this.selectedIndices.add(r.i);
                        this.setDirtyCanvas(true);
                        return true;
                    }
                }
            }
            if (this.btnRects) {
                for (const b of this.btnRects) {
                    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                        this.handleButtonClick(b.key);
                        return true;
                    }
                }
            }
        };

        // Hover
        const onMouseMove = nodeType.prototype.onMouseMove;
        nodeType.prototype.onMouseMove = function (event, pos, graphPos) {
            if (onMouseDown) onMouseDown.apply(this, arguments);
            const x = pos[0];
            const y = pos[1];
            let needsRedraw = false;

            if (this.btnRects) {
                for (const b of this.btnRects) {
                    const isOver = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
                    if (this.buttons[b.key].hover !== isOver) {
                        this.buttons[b.key].hover = isOver;
                        needsRedraw = true;
                    }
                }
            }
            if (needsRedraw) this.setDirtyCanvas(true);
        };

        // 3. Logic
        nodeType.prototype.handleButtonClick = async function (key) {
            if (key === 'all') {
                this.imagePaths.forEach((_, i) => this.selectedIndices.add(i));
            } else if (key === 'none') {
                this.selectedIndices.clear();
            } else if (key === 'cancel') {
                try { await api.interrupt(); } catch (e) { }
                this.sendSelection([]);
            } else if (key === 'confirm') {
                const sorted = Array.from(this.selectedIndices).sort((a, b) => a - b);
                this.sendSelection(sorted);
            }
            this.setDirtyCanvas(true);
        };

        nodeType.prototype.sendSelection = async function (indices) {
            try {
                await api.fetchApi("/3r3bos/batch_selection", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: String(this.id), selection: indices })
                });
                this.imagePaths = [];
                this.setDirtyCanvas(true);
            } catch (e) { alert(e); }
        };

        api.addEventListener("3r3bos-batch-selector-start", (event) => {
            const { id, images } = event.detail;
            const node = app.graph.getNodeById(id);
            if (!node) return;

            node.imagePaths = images;
            node.images = new Array(images.length);
            node.selectedIndices.clear();

            images.forEach((f, i) => {
                const img = new Image();
                img.src = api.apiURL(`/view?filename=${f}&type=temp`);
                img.onload = () => node.setDirtyCanvas(true);
                node.images[i] = img;
            });

            // Auto size
            const areaPerImage = 150 * 150;
            const totalArea = areaPerImage * images.length;
            const targetW = 340;
            const targetH = (totalArea / targetW) + 100;

            if (node.size[0] < targetW || node.size[1] < targetH) {
                node.setSize([Math.max(node.size[0], targetW), Math.max(node.size[1], targetH)]);
            }
            node.setDirtyCanvas(true);
        });
    }
});
