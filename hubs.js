document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.hub-slide');
    const nextBtn = document.querySelector('.next-btn');
    const prevBtn = document.querySelector('.prev-btn');

    if (slides.length === 0 || !nextBtn || !prevBtn) {
        return; // Exit if slider elements aren't on the page
    }

    let currentSlide = 0;

    function showSlide(slideIndex) {
        // Remove 'active' class from all slides
        slides.forEach(slide => {
            slide.classList.remove('active');
        });

        // Add 'active' class to the target slide
        slides[slideIndex].classList.add('active');
    }

    nextBtn.addEventListener('click', () => {
        currentSlide++;
        if (currentSlide >= slides.length) {
            currentSlide = 0; // Loop back to the first slide
        }
        showSlide(currentSlide);
    });

    prevBtn.addEventListener('click', () => {
        currentSlide--;
        if (currentSlide < 0) {
            currentSlide = slides.length - 1; // Loop to the last slide
        }
        showSlide(currentSlide);
    });

    // Initialize the slider
    showSlide(currentSlide);
});