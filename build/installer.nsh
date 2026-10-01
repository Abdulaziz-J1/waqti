; Waqti installer hooks.

; The language picked in the installer's first dialog becomes the app's
; language: it is left in %APPDATA%\Waqti\installer-language, which Waqti reads
; once at its next start (src/main/index.ts) and removes. Not on silent updates.
!macro customInstall
  ${ifNot} ${isUpdated}
    CreateDirectory "$APPDATA\Waqti"
    FileOpen $0 "$APPDATA\Waqti\installer-language" w
    ${if} $LANGUAGE == 1033
      FileWrite $0 "en"
    ${else}
      FileWrite $0 "ar"
    ${endIf}
    FileClose $0
  ${endIf}
!macroend

; Uninstaller: ask whether to keep the user's data (%APPDATA%\Waqti), in the
; installer's language. Never asked during an update.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    ${if} $LANGUAGE == 1033
      MessageBox MB_YESNO|MB_ICONQUESTION "Delete Waqti's data from this computer?$\r$\n$\r$\nThis includes your usage history, focus sessions, prayer log, settings and backups.$\r$\nChoose No to keep it and pick up where you left off if you install Waqti again." /SD IDNO IDNO waqti_keep_data
    ${else}
      MessageBox MB_YESNO|MB_ICONQUESTION "هل تبي تحذف بيانات وقتي من هذا الجهاز؟$\r$\n$\r$\nتشمل سجل الاستخدام وجلسات التركيز وسجل الصلاة والإعدادات والنسخ الاحتياطية.$\r$\nاختر «لا» إذا تبي تحتفظ فيها وترجع لها لو ثبّت وقتي مرة ثانية." /SD IDNO IDNO waqti_keep_data
    ${endIf}
    RMDir /r "$APPDATA\Waqti"
    waqti_keep_data:
  ${endIf}
!macroend

; Updates install over the previous version instead of running its uninstaller
; first. That uninstaller is copied to a temp folder and run from there, which
; antivirus sandboxes (Avast, AVG) treat as an unknown program and kill: the
; installer then retries, says Waqti "cannot be closed" and stops, leaving a
; half-removed copy. Installing over it replaces every file just the same, and
; the uninstall entry is written again at the end. Defining this macro replaces
; the default running-app check, so it runs that check itself (with what it
; needs, which electron-builder only includes when no custom check exists).
!include "getProcessInfo.nsh"
Var pid

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro _CHECK_APP_RUNNING
  !ifndef BUILD_UNINSTALLER
    DeleteRegValue SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
    !ifdef UNINSTALL_REGISTRY_KEY_2
      DeleteRegValue SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY_2}" "UninstallString"
    !endif
  !endif
!macroend
