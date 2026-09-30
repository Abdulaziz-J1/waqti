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
; installer's language. Never asked during an update (the installer runs the
; old uninstaller silently).
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
