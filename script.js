document.addEventListener('DOMContentLoaded', () => {
    // --- Top-level element selections ---
    const navbar = document.querySelector('.navbar');
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const backToTopButton = document.querySelector('.back-to-top');

    // --- Scrolled Navbar Effect ---
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }, { passive: true });
    }

    // --- Mobile Hamburger Menu ---
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            // When opening the hamburger, close any open dropdowns
            document.querySelectorAll('.nav-item.dropdown.open').forEach(dropdown => {
                dropdown.classList.remove('open');
            });
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        });
    }

    // --- NEW: Consolidated Mobile Navigation Logic ---
if (navMenu) {
    navMenu.addEventListener('click', (e) => {
        // Only run logic if the mobile menu is active
        if (!navMenu.classList.contains('active')) {
            return;
        }

        // Find the link that was clicked, whether it's a main link or a sub-menu link
        const link = e.target.closest('a');
        if (!link) {
            return; // Exit if the click wasn't on or inside a link
        }

        const parentLi = link.parentElement;

        // Check if the link is a top-level dropdown toggle (like "Network" or "About Us")
        if (parentLi.classList.contains('dropdown') && parentLi.parentElement === navMenu) {
            // This is a dropdown toggle link. Prevent it from navigating.
            e.preventDefault(); 

            // Toggle the 'open' class to show or hide the submenu
            parentLi.classList.toggle('open');

        } else {
            // This is a regular link OR a sub-menu link. Close the main mobile menu.
            // The browser will then handle the navigation to the link's href automatically.
            hamburger?.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
    });
}

    // --- Fade-in Animations on Scroll (IntersectionObserver) ---
    try {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
    } catch (e) {
        document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
    }

    // --- Back to Top Button ---
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            backToTopButton.classList.toggle('visible', window.scrollY > 300);
        }, { passive: true });

        backToTopButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- SVG Flight Path Animation (continuous draw while scrolling) ---
    (function initFlightPath() {
        const flightPathSection = document.querySelector('#flight-path-section');
        if (!flightPathSection) return;

        const path = document.querySelector('#flightPath');
        const plane = document.querySelector('#plane');
        if (!path || !plane) return;

        // Performance hints
        plane.style.willChange = 'transform';
        plane.style.transformOrigin = 'center center';
        plane.style.transition = plane.style.transition || 'none';

        // Safely compute path length
        let pathLength;
        try {
            pathLength = path.getTotalLength();
        } catch (err) {
            console.error('Could not compute path length for #flightPath:', err);
            return;
        }

        path.style.strokeDasharray = pathLength;
        path.style.strokeDashoffset = pathLength;
        path.style.strokeLinecap = path.style.strokeLinecap || 'round';

        // Tier thresholds
        const tierThresholds = {
            '1': 0.04,  '2': 0.12,  '3': 0.20,
            '4': 0.28,  '5': 0.36,  '6': 0.44,
            '7': 0.52,  '8': 0.60,  '9': 0.68,
            '10': 0.76, '11': 0.84, '12': 0.95
        };

        let introAnimationFinished = false;
        let hasScrolledPastIntro = false; // <-- ADDED: Tracks if user scroll has passed the intro animation point

        // Safe plane size getter
        const getPlaneSize = () => {
            const w = plane.offsetWidth || 40;
            const h = plane.offsetHeight || 40;
            return { w, h };
        };

        // Position plane at a given length along the path
        const positionPlaneAtLength = (drawLength, scale = 1) => {
            if (typeof path.getScreenCTM !== 'function' || typeof path.getPointAtLength !== 'function') return;
            const ctm = path.getScreenCTM();
            if (!ctm) return;

            const clamped = Math.max(0, Math.min(drawLength, pathLength));
            const point = path.getPointAtLength(clamped);
            const sectionRect = flightPathSection.getBoundingClientRect();

            const screenPoint = {
                x: point.x * ctm.a + point.y * ctm.c + ctm.e,
                y: point.x * ctm.b + point.y * ctm.d + ctm.f
            };

            const planeX = screenPoint.x - sectionRect.left;
            const planeY = screenPoint.y - sectionRect.top;

            const delta = Math.min(10, clamped);
            const prevPoint = path.getPointAtLength(Math.max(clamped - delta, 0));
            let angle = (Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * (180 / Math.PI)) + 90;

            if (clamped >= pathLength - 1) {
                angle = 0;
            }

            const { w, h } = getPlaneSize();
            const tx = planeX - (w / 2);
            const ty = planeY - (h / 2);

            plane.style.transform = `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${angle}deg)`;
        };
        
        // Compute draw length from scroll and apply both stroke + plane instantly
        const computeAndApplyFromScroll = () => {
            if (!introAnimationFinished) return;

            const sectionRect = flightPathSection.getBoundingClientRect();
            const triggerPoint = window.innerHeight * 0.5;
            const scrollDistance = triggerPoint - sectionRect.top;
            const animationDistance = Math.max(sectionRect.height * 0.9, 1);

            let pathScrollPercent = scrollDistance / animationDistance;
            pathScrollPercent = Math.min(Math.max(pathScrollPercent, 0), 1);
            
            // --- NEW LOGIC TO PREVENT JUMP ---
            const introTargetPercent = tierThresholds['1'] || 0.04;

            // Only check this logic if we haven't already passed the intro point
            if (!hasScrolledPastIntro) {
                if (pathScrollPercent >= introTargetPercent) {
                    // The user has now scrolled past the intro animation's end point.
                    // From now on, the plane will follow the scrollbar directly.
                    hasScrolledPastIntro = true;
                } else {
                    // If the scroll is behind the plane, force the plane to wait at the intro's end point.
                    pathScrollPercent = introTargetPercent;
                }
            }
            // --- END NEW LOGIC ---

            // Update tier visuals
            for (const tierNum in tierThresholds) {
                const isFinalStep = tierNum === '12';
                const contentElement = isFinalStep 
                    ? document.querySelector('#step-12 .path-cta')
                    : document.querySelector(`#step-${tierNum} .path-content`);

                if (contentElement) {
                    contentElement.classList.toggle('completed', pathScrollPercent >= tierThresholds[tierNum]);
                }
            }

            const drawLength = pathScrollPercent * pathLength;

            path.style.strokeDashoffset = pathLength - drawLength;
            positionPlaneAtLength(drawLength);
        };

        // --- NEW AND IMPROVED INTRO ANIMATION ---
        const introAnimation = () => {
            const animationDuration = 2000;
            const targetScrollPercent = tierThresholds['1'] || 0.04;
            const targetDrawLength = pathLength * targetScrollPercent;
            let startTime = null;
            
            const endPoint = path.getPointAtLength(targetDrawLength);
            const prevPointForAngle = path.getPointAtLength(Math.max(0, targetDrawLength - 10));
            const endAngle = (Math.atan2(endPoint.y - prevPointForAngle.y, endPoint.x - prevPointForAngle.x) * (180 / Math.PI)) + 90;
            const { w, h } = getPlaneSize();

            const startX = path.getPointAtLength(0).x - (w / 2);
            const startY = -100;
            const startAngle = 180;
            const startScale = 0.2;

            const animate = (timestamp) => {
                if (!startTime) startTime = timestamp;
                const elapsedTime = timestamp - startTime;
                const progress = Math.min(elapsedTime / animationDuration, 1);
                const eased = progress * (2 - progress);

                const currentDrawLength = targetDrawLength * eased;
                path.style.strokeDashoffset = pathLength - currentDrawLength;

                const ctm = path.getScreenCTM();
                if (ctm) {
                     const sectionRect = flightPathSection.getBoundingClientRect();
                    
                    const screenEndPoint = {
                        x: endPoint.x * ctm.a + endPoint.y * ctm.c + ctm.e,
                        y: endPoint.x * ctm.b + endPoint.y * ctm.d + ctm.f
                    };

                    const finalPlaneX = screenEndPoint.x - sectionRect.left - (w / 2);
                    const finalPlaneY = screenEndPoint.y - sectionRect.top - (h / 2);

                    const currentX = startX + (finalPlaneX - startX) * eased;
                    const currentY = startY + (finalPlaneY - startY) * eased;
                    const currentAngle = startAngle + (endAngle - startAngle) * eased;
                    const currentScale = startScale + (1 - startScale) * eased;
                    const currentOpacity = eased;

                    plane.style.opacity = currentOpacity;
                    plane.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale}) rotate(${currentAngle}deg)`;
                }

                if (elapsedTime < animationDuration) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation finished. The plane will now wait for the user to scroll.
                    introAnimationFinished = true;
                    plane.style.transition = 'none';
                }
            };
            
            requestAnimationFrame(animate);
        };

        const runWhenPlaneReady = (cb) => {
            const isImg = plane.tagName.toLowerCase() === 'img';
            if (!isImg) {
                cb();
                return;
            }
            if (plane.complete && plane.naturalWidth !== 0) {
                cb();
            } else {
                const onLoad = () => {
                    plane.removeEventListener('load', onLoad);
                    cb();
                };
                plane.addEventListener('load', onLoad);
                setTimeout(() => {
                    plane.removeEventListener('load', onLoad);
                    cb();
                }, 1200);
            }
        };

        let isTicking = false;
        const onScroll = () => {
            if (!introAnimationFinished) return;

            if (!isTicking) {
                window.requestAnimationFrame(() => {
                    computeAndApplyFromScroll();
                    isTicking = false;
                });
                isTicking = true;
            }
        };

        runWhenPlaneReady(() => {
            // --- NEW REFRESH-HANDLING LOGIC ---
            // Check the initial scroll position to decide whether to play the intro.
            if (window.scrollY < 100) {
                // User is at the top of the page, so play the intro animation.
                setTimeout(introAnimation, 200);
            } else {
                // User is already scrolled down, so skip the intro.
                introAnimationFinished = true;
                hasScrolledPastIntro = true; // Instantly mark intro as passed
                plane.style.opacity = '1'; // Make the plane visible immediately.
                computeAndApplyFromScroll(); // Instantly sync the path and plane to the scroll position.
            }
            // --- END NEW LOGIC ---

            // These listeners are required for both scenarios.
            window.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', computeAndApplyFromScroll);
        });
    })();
});