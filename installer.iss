; PresenzaCloud Connector — Inno Setup Script
; Crea un installer Windows .exe con wizard grafico.
;
; Come buildare:
;   1. Installa Inno Setup da https://jrsoftware.org/isdl.php
;   2. Buildare il connector.exe con pkg:
;        npm install -g pkg
;        pkg connector.js --target node18-win-x64 --output dist/connector.exe
;        pkg setup-wizard.js --target node18-win-x64 --output dist/setup-wizard.exe
;   3. Apri questo file in Inno Setup Compiler e clicca Build
;
; Per installer PRE-CONFIGURATO con token (visita con USB):
;   Imposta PRESET_TOKEN con il token generato dal pannello admin
;   prima di buildare. Il consulente non dovrà inserire nulla.

#define AppName "PresenzaCloud Connector"
#define AppVersion "1.0.0"
#define AppPublisher "PresenzaCloud"
#define AppURL "https://presenzacloud.it"
#define AppExeName "connector.exe"

; ── IMPOSTA QUI IL TOKEN PRE-CONFIGURATO PER INSTALLAZIONE AUTOMATICA ──────
; Lascia vuoto se vuoi che l'utente inserisca il token durante l'installazione
; Compila con token per la visita con chiavetta USB:
;   #define PresetToken "il_tuo_token_generato_dal_pannello"
#define PresetToken ""
; ────────────────────────────────────────────────────────────────────────────

[Setup]
AppId={{F7A3B2C1-4D5E-6F7A-8B9C-0D1E2F3A4B5C}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
DefaultDirName={autopf}\PresenzaCloud\Connector
DefaultGroupName={#AppName}
AllowNoIcons=yes
; Icona dell'installer (opzionale — aggiungi icon.ico nella cartella)
; SetupIconFile=icon.ico
OutputDir=dist
OutputBaseFilename=PresenzaCloud-Connector-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
; Mostra il wizard con sfondo colorato
WizardSizePercent=120

[Languages]
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "startuprun";  Description: "Avvia automaticamente con Windows"; GroupDescription: "Avvio automatico"

[Files]
; I due eseguibili buildati con pkg (Node.js bundled dentro)
Source: "dist\connector.exe";     DestDir: "{app}"; Flags: ignoreversion
Source: "dist\setup-wizard.exe";  DestDir: "{app}"; Flags: ignoreversion
Source: "README.md";              DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}";            Filename: "{app}\{#AppExeName}"
Name: "{group}\Apri cartella output";  Filename: "{app}\output"
Name: "{group}\Disinstalla";           Filename: "{uninstallexe}"
Name: "{commondesktop}\{#AppName}";    Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
; Avvio automatico con Windows (se selezionato)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "PresenzaCloudConnector"; \
  ValueData: """{app}\{#AppExeName}"""; \
  Flags: uninsdeletevalue; Tasks: startuprun

[Run]
; Esegue il wizard di attivazione subito dopo l'installazione
#if PresetToken != ""
  ; Token pre-configurato: attivazione silenziosa, nessun input richiesto
  Filename: "{app}\setup-wizard.exe"; \
    Parameters: "--token={#PresetToken}"; \
    Description: "Configura il connector"; \
    Flags: nowait postinstall runascurrentuser
#else
  ; Token da inserire: apre il wizard interattivo
  Filename: "{app}\setup-wizard.exe"; \
    Description: "Configura il connector (inserisci il token di attivazione)"; \
    Flags: nowait postinstall runascurrentuser
#endif

[UninstallDelete]
Type: filesandordirs; Name: "{app}\output"
Type: files;          Name: "{app}\config.json"
