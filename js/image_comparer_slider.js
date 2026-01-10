// Author: 3R3BOS

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "Comfy.RefinerCompare",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "RefinerCompareNode") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                const node = this;

                // --- SMART INPUT MANAGEMENT (Compaction + Expansion) ---
                this.manageInputs = function() {
                    const inputs = node.inputs;
                    if (!inputs) return;

                    // 1. COMPACTION: Remove intermediate gaps (The famous "Shift Up")
                    let changed = true;
                    while (changed) {
                        changed = false;
                        
                        // Find the last connected slot to avoid deleting the tail
                        let lastConnectedIndex = -1;
                        for (let i = 0; i < node.inputs.length; i++) {
                            if (node.inputs[i].link !== null) lastConnectedIndex = i;
                        }

                        // We look for a gap (link === null) BEFORE the last connected one
                        for (let i = 0; i < lastConnectedIndex; i++) {
                            if (node.inputs[i].link === null) {
                                // Found a gap!
                                
                                // CRITICAL STEP: Tell the ComfyUI graph that the links below
                                // must move up one slot (index - 1)
                                const graph = app.graph;
                                if (graph && graph.links) {
                                    for (const linkId in graph.links) {
                                        const link = graph.links[linkId];
                                        if (!link) continue;
                                        
                                        // If a link points to our node on a slot lower than the gap
                                        if (link.target_id === node.id && link.target_slot > i) {
                                            link.target_slot -= 1; // Hop, move it up
                                        }
                                    }
                                }

                                // Physical removal of the empty input
                                node.removeInput(i);
                                
                                changed = true;
                                break; // Restart the loop to ensure order
                            }
                        }
                    }

                    // 2. EXPANSION / FINAL CLEANUP
                    // We always want exactly 1 empty slot after the last connected one
                    let lastLinkIndex = -1;
                    for (let i = 0; i < node.inputs.length; i++) {
                        if (node.inputs[i].link !== null) lastLinkIndex = i;
                    }

                    const targetCount = lastLinkIndex + 2; 
                    // CHANGE: Limit set to 20 instead of 50
                    const finalCount = Math.min(20, Math.max(1, targetCount));

                    // Size adjustment (Add or Remove at tail)
                    if (node.inputs.length > finalCount) {
                        for (let i = node.inputs.length - 1; i >= finalCount; i--) {
                            node.removeInput(i);
                        }
                    } else if (node.inputs.length < finalCount) {
                        for (let i = node.inputs.length; i < finalCount; i++) {
                            node.addInput(`image_${i + 1}`, "IMAGE");
                        }
                    }

                    // 3. AESTHETIC RENAMING
                    // Rename everything neatly image_1, image_2, etc. to be clean
                    node.inputs.forEach((inp, i) => {
                        const expectedName = `image_${i + 1}`;
                        if (inp.name !== expectedName || inp.label !== expectedName) {
                            inp.name = expectedName;
                            inp.label = expectedName;
                        }
                    });
                };

                // Init on startup (with a small delay for graph loading)
                setTimeout(() => {
                    this.manageInputs();
                }, 100);

                // Listener: Triggered when connecting OR disconnecting a cable
                this.onConnectionsChange = function(type, index, connected, link_info, slotObj) {
                    // type 1 = Input
                    if (type === 1) { 
                        this.manageInputs();
                    }
                };

                // --- SLIDER WIDGET (IMPROVED UI) ---
                
                // Inject Custom CSS for the slider to make it look "Pro"
                const styleId = "refiner-compare-style-3r3bos";
                if (!document.getElementById(styleId)) {
                    const styleEl = document.createElement("style");
                    styleEl.id = styleId;
                    styleEl.textContent = `
                        .refiner-slider-input {
                            -webkit-appearance: none;
                            width: 100%;
                            height: 6px;
                            background: #1a1a1a;
                            border-radius: 3px;
                            outline: none;
                            margin: 10px 0;
                            box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
                        }
                        .refiner-slider-input::-webkit-slider-thumb {
                            -webkit-appearance: none;
                            appearance: none;
                            width: 14px;
                            height: 14px;
                            border-radius: 50%;
                            background: #e0e0e0;
                            cursor: pointer;
                            border: 1px solid #000;
                            box-shadow: 0 0 5px rgba(255,255,255,0.2);
                            transition: transform 0.1s;
                        }
                        .refiner-slider-input::-webkit-slider-thumb:hover {
                            transform: scale(1.2);
                            background: #fff;
                        }
                        .refiner-slider-input::-moz-range-thumb {
                            width: 14px;
                            height: 14px;
                            border-radius: 50%;
                            background: #e0e0e0;
                            cursor: pointer;
                            border: 1px solid #000;
                        }
                    `;
                    document.head.appendChild(styleEl);
                }

                const widget = {
                    type: "div",
                    name: "refiner_compare_widget",
                    draw(ctx, node, widget_width, y, widget_height) { },
                    computeSize(...args) { return [400, 350]; },
                };

                const container = document.createElement("div");
                // More "ComfyUI-native" look with darker grey and slight borders
                container.style.cssText = `display:flex;flex-direction:column;background:#353535;color:#eee;padding:12px;border-radius:8px;height:100%;box-sizing:border-box;overflow:hidden;font-family:'Segoe UI', Roboto, sans-serif;border: 1px solid #222;box-shadow: 0 4px 6px rgba(0,0,0,0.3);`;

                const imageArea = document.createElement("div");
                // Improved transparency grid
                imageArea.style.cssText = `flex-grow:1;position:relative;background:#151515;border-radius:6px;overflow:hidden;border:1px solid #000;
                background-image: 
                    linear-gradient(45deg, #222 25%, transparent 25%), 
                    linear-gradient(-45deg, #222 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, #222 75%), 
                    linear-gradient(-45deg, transparent 75%, #222 75%);
                background-size: 20px 20px;
                background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
                min-height:220px; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);`;
                
                const placeholder = document.createElement("div");
                placeholder.textContent = "Waiting for images...";
                placeholder.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#777;font-style:italic;font-size:12px;";
                imageArea.appendChild(placeholder);

                const imgStack = document.createElement("div");
                imgStack.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
                imageArea.appendChild(imgStack);

                const infoOverlay = document.createElement("div");
                // Better looking badge
                infoOverlay.style.cssText = "position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.6);padding:4px 8px;border-radius:12px;font-size:11px;pointer-events:none;border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(2px);";
                infoOverlay.innerHTML = '<span id="step-lbl" style="font-weight:600;color:#fff;">0 / 0</span>';
                imageArea.appendChild(infoOverlay);

                const controls = document.createElement("div");
                controls.style.cssText = "margin-top:12px;padding:0 4px;";
                
                const sliderLabel = document.createElement("div");
                sliderLabel.style.cssText = "display:flex;justify-content:space-between;font-size:11px;color:#bbb;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;";
                sliderLabel.innerHTML = "<span>Original</span><span>Refined</span>";
                
                const slider = document.createElement("input");
                slider.type = "range";
                slider.className = "refiner-slider-input"; // Use class for the new CSS styles
                slider.min = "0";
                slider.max = "0";
                slider.value = "0";
                slider.step = "0.01";
                slider.disabled = true;

                controls.appendChild(sliderLabel);
                controls.appendChild(slider);

                container.appendChild(imageArea);
                container.appendChild(controls);

                this.addDOMWidget("refiner_widget", "custom_html", container, { serialize: false, hideOnZoom: false });

                let cachedImages = [];

                function updateDisplay() {
                    if (cachedImages.length === 0) return;
                    const val = parseFloat(slider.value);
                    const lowerIndex = Math.floor(val);
                    const upperIndex = Math.ceil(val);
                    const fraction = val - lowerIndex;
                    infoOverlay.querySelector("#step-lbl").textContent = `${(val+1).toFixed(1)} / ${cachedImages.length}`;
                    cachedImages.forEach((imgObj, i) => {
                        const imgEl = imgObj.element;
                        if (!imgEl) return;
                        if (i < lowerIndex) { imgEl.style.opacity = 1; imgEl.style.zIndex = i; }
                        else if (i === lowerIndex) { imgEl.style.opacity = 1; imgEl.style.zIndex = i; }
                        else if (i === upperIndex) { imgEl.style.opacity = fraction; imgEl.style.zIndex = i; }
                        else { imgEl.style.opacity = 0; imgEl.style.zIndex = i; }
                    });
                }

                slider.addEventListener("input", updateDisplay);

                this.onExecuted = function(message) {
                    if (!message || !message.slider_images) return;
                    imgStack.innerHTML = "";
                    cachedImages = [];
                    placeholder.style.display = "none";
                    const imagesData = message.slider_images;
                    imagesData.forEach((imgData, index) => {
                        const img = new Image();
                        img.src = api.apiURL(`/view?filename=${imgData.filename}&type=${imgData.type}&subfolder=${imgData.subfolder}`);
                        img.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;transition:none;";
                        img.style.opacity = index === 0 ? 1 : 0;
                        imgStack.appendChild(img);
                        cachedImages.push({ data: imgData, element: img });
                    });
                    if (cachedImages.length > 1) {
                        slider.max = cachedImages.length - 1;
                        slider.disabled = false;
                        slider.value = slider.max;
                    } else {
                        slider.max = 0;
                        slider.disabled = true;
                    }
                    updateDisplay();
                };

                return r;
            };
        }
    }
});
