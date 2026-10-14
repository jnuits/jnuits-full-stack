# Bundled site fonts

Inter, JetBrains Mono and Lora retain the existing sans, mono and serif CSS variables and weight ranges. Noto Sans Bengali stays unchanged in its own directory. These local assets replace build-time Google Fonts requests, which can fail when Google returns extensionless font URLs.

The three source fonts and adjacent `OFL.txt` licenses come from [Google Fonts at commit 66928797f271fed5ee428544e7229685e2d90127](https://github.com/google/fonts/tree/66928797f271fed5ee428544e7229685e2d90127). They remain licensed under the SIL Open Font License 1.1; copyright notices are included unchanged.

FontTools 4.60.1 with WOFF2 support compressed the normal variable TTF files. Full upstream character coverage is retained. Inter's optical-size axis is fixed at its default 14, matching the previous Google request that selected only weight. JetBrains Mono and Lora retain their original variable weight axes without instancing or subsetting. No runtime or application dependency was added.

| Family | Version | Source TTF SHA-256 | Bundled WOFF2 SHA-256 | Bytes |
| --- | --- | --- | --- | --- |
| inter | Version 4.001;git-66647c0bb | `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031` | `b30dd38f082a2881ab101fae208a027706103f0f0cb73fccd0e73218258da5a6` | 236640 |
| jetbrainsmono | Version 2.211 | `48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda` | `7b7f3419196f675a973d30cb70078749120caddea86c8547ebf54a8db2ca13af` | 71736 |
| lora | Version 3.008 | `822a6621ccbe8d97d20ac88c1c41f5615c9c2c202eaa75f272cd452aac6475a7` | `7c514f026f03de1b0fc344c0c0f0df141fcf16b6f9ab672db191908ba740dab6` | 85096 |

The build smoke job sets Next's test hook to `scripts/fixtures/no-google-fonts.cjs`. Any future `next/font/google` import fails that build instead of contacting Google. Production uses the same local assets without the test hook. Browser smoke checks load every existing family and required weight from the rendered CSS variables.

For an intentional update, fetch fonts from an immutable upstream revision, retain licenses, verify full character coverage and weight axes, update these receipts, and run the production build and three-engine browser smoke. Never replace these files with HTML/error responses from a download.
