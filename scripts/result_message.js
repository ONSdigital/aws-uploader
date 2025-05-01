(function() {
    var s = ['https://cdn.ons.gov.uk/sdc/design-system/70.0.8/scripts/main.js'],
      c = document.createElement('script');
    if (!('noModule' in c)) {
      for (var i = 0; i < s.length; i++) {
        s[i] = s[i].replace('.js', '.es5.js');
      }
    }
    for (var i = 0; i < s.length; i++) {
      var e = document.createElement('script');
      e.src = s[i];
      document.body.appendChild(e);
    }
  })();
