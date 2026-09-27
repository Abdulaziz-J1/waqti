; Waqti uninstaller: ask whether to keep the user's data (%APPDATA%\Waqti).
; Never asked during an update (the installer runs the old uninstaller silently).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "هل تبي تحذف بيانات وقتي من هذا الجهاز؟$\r$\n$\r$\nتشمل سجل الاستخدام وجلسات التركيز وسجل الصلاة والإعدادات والنسخ الاحتياطية.$\r$\nاختر «لا» إذا تبي تحتفظ فيها وترجع لها لو ثبّت وقتي مرة ثانية." /SD IDNO IDNO waqti_keep_data
      RMDir /r "$APPDATA\Waqti"
    waqti_keep_data:
  ${endIf}
!macroend
