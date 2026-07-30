document.addEventListener('DOMContentLoaded', function () {
  var faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (item) {
    var button = item.querySelector('.faq-toggle');
    var content = item.querySelector('.faq-content');

    if (!button || !content) return;

    content.style.overflow = 'hidden';
    content.style.transition = 'max-height 0.35s ease';
    content.style.maxHeight = '0px';

    button.addEventListener('click', function () {
      var isOpen = item.classList.contains('faq-open');

      faqItems.forEach(function (otherItem) {
        if (otherItem !== item && otherItem.classList.contains('faq-open')) {
          var otherContent = otherItem.querySelector('.faq-content');
          otherItem.classList.remove('faq-open');
          if (otherContent) {
            otherContent.style.maxHeight = '0px';
          }
        }
      });

      if (isOpen) {
        item.classList.remove('faq-open');
        content.style.maxHeight = '0px';
      } else {
        item.classList.add('faq-open');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });

  window.addEventListener('resize', function () {
    var openItem = document.querySelector('.faq-item.faq-open');
    if (!openItem) return;
    var openContent = openItem.querySelector('.faq-content');
    if (openContent) {
      openContent.style.maxHeight = openContent.scrollHeight + 'px';
    }
  });
});