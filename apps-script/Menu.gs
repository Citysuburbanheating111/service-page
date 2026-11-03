// Menu set-up for the City Suburban writing sheet. Paste as its own file (Menu.gs); one copy per spreadsheet.
// Each tab's script defines its own uniquely named menu function and no onOpen, so pasting one never overwrites
// another tab's menu.
function onOpen() {
  var menus = ['servicePagesMenu', 'serviceAreaPagesMenu']
  for (var i = 0; i < menus.length; i++) {
    var fn = globalThis[menus[i]]
    if (typeof fn === 'function') fn()
  }
}
