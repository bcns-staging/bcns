import type { IControl, Map as MapLibreMap } from "maplibre-gl";

const LAYERS_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12,16L19.36,10.27L21,9L12,2L3,9L4.63,10.27M12,18.54L4.62,12.81L3,14.07L12,21.07L21,14.07L19.37,12.8L12,18.54Z" /></svg>';

/** A custom MapLibre control button that toggles the layers side panel. */
export class LayersControl implements IControl {
  private container: HTMLDivElement | undefined;

  constructor(private onToggle: () => void) {}

  onAdd(_map: MapLibreMap): HTMLElement {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "maplibregl-ctrl-icon";
    button.setAttribute("aria-label", "Layers");
    button.innerHTML = LAYERS_ICON;
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.onclick = () => this.onToggle();

    this.container.appendChild(button);
    return this.container;
  }

  onRemove(): void {
    this.container?.parentNode?.removeChild(this.container);
    this.container = undefined;
  }
}
