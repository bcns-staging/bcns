import type { IControl, Map as MapLibreMap } from "maplibre-gl";

/** A custom MapLibre control button that toggles a side panel (Layers, Search, ...). */
export class IconButtonControl implements IControl {
  private container: HTMLDivElement | undefined;

  constructor(
    private icon: string,
    private label: string,
    private onToggle: () => void
  ) {}

  onAdd(_map: MapLibreMap): HTMLElement {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "maplibregl-ctrl-icon";
    button.setAttribute("aria-label", this.label);
    button.innerHTML = this.icon;
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
