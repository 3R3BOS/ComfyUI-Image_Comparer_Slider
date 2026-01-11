// Developed by 3R3BOS
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "3R3BOS.VisualGatekeeper",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Visual Gatekeeper (3R3BOS)") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                this.image = new Image();
                this.imageReady = false;
                this.currentStatus = "Waiting...";
                this.buttons = [];

                // Button definitions
                const btnHeight = 40;
                const gap = 10;

                // Helper to add buttons
                this.addButton = (label, color, callback) => {
                    this.buttons.push({
                        label: label,
                        color: color,
                        callback: callback,
                        x: 0, y: 0, w: 0, h: btnHeight, // Geometry handled in onDraw
                        hover: false
                    });
                };

                this.addButton("APPROVE", "#28a745", () => this.sendDecision("approve"));
                this.addButton("REJECT", "#dc3545", () => this.sendDecision("reject"));

                this.setSize([300, 350]);

                return r;
            };

            // Handle Hover
            const onMouseMove = nodeType.prototype.onMouseMove;
            nodeType.prototype.onMouseMove = function (event, pos, graphPos) {
                if (onMouseMove) onMouseMove.apply(this, arguments);

                const [x, y] = pos;
                let needsRedraw = false;

                for (let btn of this.buttons) {
                    const isOver = x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
                    if (btn.hover !== isOver) {
                        btn.hover = isOver;
                        needsRedraw = true;
                    }
                }

                if (needsRedraw) {
                    this.setDirtyCanvas(true, false); // Redraw node
                }
            };

            // Custom draw to render image and buttons
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function (ctx) {
                if (onDrawForeground) onDrawForeground.apply(this, arguments);

                if (!this.flags.collapsed) {
                    const [w, h] = this.size;
                    const headerHeight = 30;

                    // 1. Draw Status
                    ctx.fillStyle = "#888";
                    ctx.font = "12px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText(this.currentStatus, w / 2, headerHeight + 15);

                    // 2. Draw Image
                    const imgY = headerHeight + 25;
                    const footerHeight = 50;
                    const availableH = h - imgY - footerHeight;

                    if (this.imageReady && this.image) {
                        const scale = Math.min(w / this.image.width, availableH / this.image.height);
                        const drawW = this.image.width * scale;
                        const drawH = this.image.height * scale;
                        const drawX = (w - drawW) / 2;
                        const drawY = imgY + (availableH - drawH) / 2;

                        ctx.drawImage(this.image, drawX, drawY, drawW, drawH);
                    } else {
                        ctx.fillStyle = "#222";
                        ctx.fillRect(10, imgY, w - 20, availableH);
                        ctx.fillStyle = "#555";
                        ctx.fillText("Waiting for Image...", w / 2, imgY + availableH / 2);
                    }

                    // 3. Draw Buttons (Minimalist + Hover)
                    const btnH = 28;
                    const btnY = h - 40;
                    const btnW = (w - 40) / 2;

                    this.buttons[0].x = 15;
                    this.buttons[0].y = btnY;
                    this.buttons[0].w = btnW;
                    this.buttons[0].h = btnH;

                    this.buttons[1].x = 25 + btnW;
                    this.buttons[1].y = btnY;
                    this.buttons[1].w = btnW;
                    this.buttons[1].h = btnH;

                    for (let btn of this.buttons) {
                        // Background (Dark normally, lighter on Hover)
                        ctx.fillStyle = btn.hover ? "#444" : "#2a2a2a";
                        ctx.beginPath();
                        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
                        ctx.fill();

                        // Border (Colored)
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = btn.color;
                        ctx.stroke();

                        // Text (Colored)
                        ctx.fillStyle = btn.color;
                        ctx.font = "12px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);

                        // Cursor pointer hint
                        if (btn.hover) {
                            app.canvas.canvas.style.cursor = "pointer";
                        }
                    }
                }
            };

            // Handle Input for Buttons
            const onMouseDown = nodeType.prototype.onMouseDown;
            nodeType.prototype.onMouseDown = function (event, pos, graphPos) {
                if (onMouseDown) onMouseDown.apply(this, arguments);

                const [x, y] = pos;
                for (let btn of this.buttons) {
                    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                        // Clicked
                        btn.callback();
                        return true; // Consume event
                    }
                }
            };

            // Handle Hover
            // ComfyUI nodes don't standardly expose onMouseMove easily without overriding logic, 
            // but we can try if we really want hover effects. For now simplified.

            // API Logic integrated in prototype
            nodeType.prototype.sendDecision = async function (decision) {
                this.currentStatus = `Sending ${decision}...`;
                this.setDirtyCanvas(true, true);

                if (decision === "reject") {
                    try {
                        await api.interrupt();
                    } catch (e) {
                        console.error("Failed to trigger interrupt:", e);
                    }
                }

                try {
                    const resp = await fetch("/3r3bos/gatekeeper/decision", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ node_id: this.id.toString(), decision: decision })
                    });

                    if (resp.ok) {
                        this.currentStatus = decision === "approve" ? "Approved." : "Rejected.";
                    } else {
                        this.currentStatus = "Error: " + resp.statusText;
                    }
                } catch (err) {
                    this.currentStatus = "Error: Connection Failed";
                }
                this.setDirtyCanvas(true, true);
            };

            // Event Listener for this node type
            // Note: listeners in setup are global.
        }
    },

    setup() {
        api.addEventListener("3r3bos.gatekeeper.show", (event) => {
            const { node_id, image_url } = event.detail;
            const node = app.graph.getNodeById(node_id);
            if (node) {
                // Update Image
                node.image.src = image_url + "&t=" + Date.now();
                node.image.onload = () => {
                    node.imageReady = true;
                    node.setDirtyCanvas(true, true);
                };

                // Expand node if needed to show image better
                if (node.size[1] < 400) {
                    node.setSize([node.size[0], 400]);
                }

                node.currentStatus = "Action Required!";
                // Bring to front logic if desired, or just focus
                app.canvas.centerOnNode(node);
                node.setDirtyCanvas(true, true);
            }
        });
    }
});

function adjustColor(color, amount) {
    return color; // Placeholder for hover boost
}
