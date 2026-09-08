import { App, Modal, Setting } from "obsidian";
import type RandomReviewPlugin from "./main";
import { getLang, Language } from "./i18n";

export class ProfilePickModal extends Modal {
  private plugin: RandomReviewPlugin;
  private language: Language;
  private selectedId: string;

  constructor(app: App, plugin: RandomReviewPlugin) {
    super(app);
    this.plugin = plugin;
    this.language = plugin.settings.language;
    const activeId = plugin.settings.activeProfileId;
    this.selectedId =
      typeof activeId === "string" &&
      plugin.settings.profiles.some((p) => p.id === activeId)
        ? activeId
        : plugin.settings.profiles[0]?.id ?? "";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("random-review-profile-pick");

    const t = getLang(this.language);
    const profiles = this.plugin.settings.profiles;

    new Setting(contentEl).setName(t.profileSelect).setHeading();

    new Setting(contentEl)
      .setName(t.profileName)
      .addDropdown((dd) => {
        profiles.forEach((p) => {
          dd.addOption(p.id, p.name);
        });
        dd.setValue(this.selectedId);
        dd.onChange((id) => (this.selectedId = id));
      });

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(t.startReview)
        .setCta()
        .onClick(() => {
          this.confirm();
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private confirm(): void {
    const profile = this.plugin.settings.profiles.find(
      (p) => p.id === this.selectedId
    );
    if (!profile) return;
    this.plugin.applyProfile(profile);
    void this.plugin.saveSettings().then(() => {
      this.close();
      void this.plugin.startReview();
    });
  }
}