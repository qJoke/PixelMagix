
document.addEventListener('DOMContentLoaded', () => {
    if (window.AOS) {
        AOS.init({
            duration: 900,
            once: true,
            offset: 60
        });
    }

    // Pricing toggle functionality
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    const pricingGrids = document.querySelectorAll('.pricing-grid');

    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.classList.contains('active')) return;

            toggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const plan = button.getAttribute('data-plan');
            const targetGrid = document.getElementById(`${plan}-plans`);

            pricingGrids.forEach(grid => {
                if (grid === targetGrid) {
                    grid.classList.add('active');
                } else {
                    grid.classList.remove('active');
                }
            });
        });
    });

    // Locale-aware currency display
    const priceElements = document.querySelectorAll('.price-value[data-price]');
    if (priceElements.length > 0) {
        const applyCurrency = (currency) => {
            const symbol = currency === 'GBP' ? '\u00a3' : '\u20ac';
            priceElements.forEach(element => {
                const amount = element.dataset.price || '';
                if (amount.length === 0) return;
                element.textContent = `${symbol}${amount}`;
            });
        };

        // Heuristic fallback (Timezone/Language)
        const checkHeuristic = () => {
            if (typeof Intl === 'undefined') return false;
            try {
                const languages = navigator.languages || [navigator.language];
                if (languages.some(lang => typeof lang === 'string' && lang.toLowerCase().includes('en-gb'))) {
                    return true;
                }
                const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
                return ['Europe/London', 'Europe/Belfast', 'Europe/Guernsey', 'Europe/Jersey', 'Europe/Isle_of_Man'].includes(timeZone);
            } catch (error) {
                return false;
            }
        };

        const detectLocation = async () => {
            // REPLACE 'YOUR_TOKEN_HERE' WITH YOUR IPINFO.IO API KEY
            // Example: const token = '1234567890abcdef';
            const token = 'b4bd4c28b8a326';

            try {
                const url = token ? `https://ipinfo.io/json?token=${token}` : 'https://ipinfo.io/json';
                const response = await fetch(url);
                if (!response.ok) throw new Error('IP check failed');

                const data = await response.json();
                return data.country === 'GB';
            } catch (error) {
                console.warn('IP geolocation failed, falling back to heuristics:', error);
                return checkHeuristic();
            }
        };

        // Initialize
        detectLocation().then(isUK => {
            applyCurrency(isUK ? 'GBP' : 'EUR');
        });
    }

    // FAQ accordion functionality
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const activeQuestion = document.querySelector('.faq-question.active');
            if (activeQuestion && activeQuestion !== question) {
                activeQuestion.classList.remove('active');
                const activeAnswer = activeQuestion.nextElementSibling;
                if (activeAnswer) {
                    activeAnswer.style.maxHeight = null;
                }
            }

            question.classList.toggle('active');
            const answer = question.nextElementSibling;

            if (question.classList.contains('active')) {
                if (answer) {
                    answer.style.maxHeight = `${answer.scrollHeight}px`;
                }
            } else if (answer) {
                answer.style.maxHeight = null;
            }
        });
    });

    // Animated counters for stats section
    const statCards = document.querySelectorAll('.stat-card');
    const observerOptions = {
        threshold: 0.35
    };

    const animateCounter = (entry) => {
        const element = entry.target;
        const targetValue = parseInt(element.dataset.target || '0', 10);
        const suffix = element.dataset.suffix || '';
        const valueElement = element.querySelector('.stat-value');
        if (!valueElement) return;

        const formatValue = (value, includeSuffix = false) => {
            const formatted = value.toLocaleString('ro-RO');
            return includeSuffix && suffix ? `${formatted}${suffix}` : formatted;
        };

        let current = 0;
        const duration = 1800;
        const stepTime = 20;
        const step = Math.max(Math.floor((targetValue * stepTime) / duration), 1);

        const counterInterval = setInterval(() => {
            current += step;
            if (current >= targetValue) {
                valueElement.textContent = formatValue(targetValue, true);
                clearInterval(counterInterval);
            } else {
                valueElement.textContent = formatValue(current);
            }
        }, stepTime);
    };

    if ('IntersectionObserver' in window) {
        const statObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry);
                    obs.unobserve(entry.target);
                }
            });
        }, observerOptions);

        statCards.forEach(card => statObserver.observe(card));
    } else {
        statCards.forEach(card => animateCounter({ target: card }));
    }

    // Testimonials infinite slider
    const sliderTrack = document.querySelector('.testimonials-track');
    const sliderWindow = document.querySelector('.testimonials-window');
    const prevButton = document.querySelector('.slider-btn--prev');
    const nextButton = document.querySelector('.slider-btn--next');

    if (sliderTrack && sliderWindow) {
        const originalSlides = Array.from(sliderTrack.children);
        const slideCount = originalSlides.length;
        const cloneCount = Math.min(3, slideCount); // Clone first/last 3 cards for seamless loop

        // Clone slides for infinite effect
        const setupInfiniteLoop = () => {
            // Clone last N slides and prepend
            for (let i = slideCount - 1; i >= slideCount - cloneCount; i--) {
                const clone = originalSlides[i].cloneNode(true);
                clone.classList.add('clone');
                clone.setAttribute('aria-hidden', 'true');
                sliderTrack.insertBefore(clone, sliderTrack.firstChild);
            }
            // Clone first N slides and append
            for (let i = 0; i < cloneCount; i++) {
                const clone = originalSlides[i].cloneNode(true);
                clone.classList.add('clone');
                clone.setAttribute('aria-hidden', 'true');
                sliderTrack.appendChild(clone);
            }
        };

        setupInfiniteLoop();

        const allSlides = Array.from(sliderTrack.children);
        let currentIndex = cloneCount; // Start at first real slide
        let isDragging = false;
        let startX = 0;
        let startScrollLeft = 0;
        let lastScrollLeft = 0;
        let lastTimestamp = 0;
        let velocity = 0;
        let momentumFrame = null;
        let isRepositioning = false;

        const getSlideWidth = () => {
            const slide = allSlides[cloneCount];
            if (!slide) return 300;
            const style = window.getComputedStyle(sliderTrack);
            const gap = parseFloat(style.gap) || 24;
            return slide.offsetWidth + gap;
        };

        const getScrollPositionForIndex = (index) => {
            const slideWidth = getSlideWidth();
            return index * slideWidth;
        };

        const stopMomentum = () => {
            if (momentumFrame) {
                cancelAnimationFrame(momentumFrame);
                momentumFrame = null;
            }
            sliderWindow.classList.remove('is-gliding');
        };

        // Instantly reposition without animation when reaching clones
        const checkBoundaries = () => {
            if (isRepositioning) return;

            const slideWidth = getSlideWidth();
            const scrollLeft = sliderWindow.scrollLeft;
            const firstRealPosition = cloneCount * slideWidth;
            const lastRealPosition = (cloneCount + slideCount - 1) * slideWidth;
            const cloneStartThreshold = (cloneCount - 1) * slideWidth;
            const cloneEndThreshold = (cloneCount + slideCount) * slideWidth;

            if (scrollLeft <= cloneStartThreshold) {
                // Jumped to start clones - reposition to end real slides
                isRepositioning = true;
                const offset = scrollLeft - cloneStartThreshold;
                sliderWindow.style.scrollBehavior = 'auto';
                sliderWindow.scrollLeft = lastRealPosition + offset;
                currentIndex = cloneCount + slideCount - 1;
                requestAnimationFrame(() => {
                    sliderWindow.style.scrollBehavior = '';
                    isRepositioning = false;
                });
            } else if (scrollLeft >= cloneEndThreshold) {
                // Jumped to end clones - reposition to start real slides
                isRepositioning = true;
                const offset = scrollLeft - cloneEndThreshold;
                sliderWindow.style.scrollBehavior = 'auto';
                sliderWindow.scrollLeft = firstRealPosition + offset;
                currentIndex = cloneCount;
                requestAnimationFrame(() => {
                    sliderWindow.style.scrollBehavior = '';
                    isRepositioning = false;
                });
            }
        };

        // Initialize position to first real slide
        const initPosition = () => {
            sliderWindow.style.scrollBehavior = 'auto';
            sliderWindow.scrollLeft = getScrollPositionForIndex(cloneCount);
            requestAnimationFrame(() => {
                sliderWindow.style.scrollBehavior = '';
            });
        };

        const scrollToIndex = (index, smooth = true) => {
            stopMomentum();
            currentIndex = index;
            const targetScroll = getScrollPositionForIndex(index);
            sliderWindow.scrollTo({
                left: targetScroll,
                behavior: smooth ? 'smooth' : 'auto'
            });
        };

        const scrollByStep = (direction) => {
            stopMomentum();
            currentIndex += direction;
            scrollToIndex(currentIndex, true);

            // Check boundaries after scroll completes
            setTimeout(checkBoundaries, 350);
        };

        prevButton?.addEventListener('click', () => scrollByStep(-1));
        nextButton?.addEventListener('click', () => scrollByStep(1));

        const startMomentumScroll = () => {
            stopMomentum();
            sliderWindow.classList.add('is-gliding');
            const friction = 0.94;
            const minVelocity = 0.008;
            let currentVelocity = Math.max(Math.min(velocity, 3.5), -3.5);
            let lastTime = performance.now();

            const step = (now) => {
                if (isRepositioning) {
                    momentumFrame = requestAnimationFrame(step);
                    return;
                }

                const deltaTime = now - lastTime;
                lastTime = now;
                sliderWindow.scrollLeft += currentVelocity * deltaTime;
                currentVelocity *= friction;

                checkBoundaries();

                if (Math.abs(currentVelocity) < minVelocity) {
                    stopMomentum();
                    // Snap to nearest slide
                    const slideWidth = getSlideWidth();
                    const nearestIndex = Math.round(sliderWindow.scrollLeft / slideWidth);
                    scrollToIndex(nearestIndex, true);
                    return;
                }

                momentumFrame = requestAnimationFrame(step);
            };

            momentumFrame = requestAnimationFrame(step);
        };

        const endDrag = (event) => {
            if (!isDragging) return;
            isDragging = false;
            sliderWindow.classList.remove('is-grabbing');
            sliderWindow.style.scrollBehavior = '';

            if (Math.abs(velocity) < 0.01) {
                // Snap to nearest slide
                const slideWidth = getSlideWidth();
                const nearestIndex = Math.round(sliderWindow.scrollLeft / slideWidth);
                scrollToIndex(nearestIndex, true);
            } else {
                startMomentumScroll();
            }

            if (
                event &&
                typeof sliderWindow.releasePointerCapture === 'function' &&
                typeof sliderWindow.hasPointerCapture === 'function' &&
                sliderWindow.hasPointerCapture(event.pointerId)
            ) {
                sliderWindow.releasePointerCapture(event.pointerId);
            }
        };

        sliderWindow.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            stopMomentum();
            isDragging = true;
            startX = event.clientX;
            startScrollLeft = sliderWindow.scrollLeft;
            lastScrollLeft = startScrollLeft;
            lastTimestamp = performance.now();
            velocity = 0;
            sliderWindow.classList.add('is-grabbing');
            sliderWindow.style.scrollBehavior = 'auto';
            if (typeof sliderWindow.setPointerCapture === 'function') {
                sliderWindow.setPointerCapture(event.pointerId);
            }
        });

        sliderWindow.addEventListener('pointermove', (event) => {
            if (!isDragging) return;
            const delta = event.clientX - startX;
            sliderWindow.scrollLeft = startScrollLeft - delta;

            const now = performance.now();
            const elapsed = now - lastTimestamp;
            if (elapsed > 0) {
                const currentScroll = sliderWindow.scrollLeft;
                velocity = (currentScroll - lastScrollLeft) / elapsed;
                lastScrollLeft = currentScroll;
                lastTimestamp = now;
            }

            checkBoundaries();
        });

        ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => {
            sliderWindow.addEventListener(type, endDrag);
        });

        sliderWindow.addEventListener('scroll', () => {
            if (!isDragging && !isRepositioning) {
                checkBoundaries();
            }
        }, { passive: true });

        window.addEventListener('resize', () => {
            stopMomentum();
            // Recenter on current slide after resize
            scrollToIndex(currentIndex, false);
        });

        // Initialize
        initPosition();
    }

    // Recent movies slider + trailer modal
    const recentMoviesTrack = document.getElementById('recent-movies-track');
    const recentMoviesWindow = document.querySelector('.recent-movies-window');
    const recentMoviesPrev = document.querySelector('.recent-movies-btn--prev');
    const recentMoviesNext = document.querySelector('.recent-movies-btn--next');

    const recentMovies = [
        {
            title: 'Prompt',
            query: 'Prompt',
            poster: 'posters/prompt.jpg',
            releaseDate: '2025-12-05',
            trailerUrl: 'https://www.youtube.com/watch?v=RTuoFcydFtw'
        },
        {
            title: 'Ricky Gervais: Mortality',
            query: 'Ricky Gervais: Mortality',
            poster: 'posters/ricky-gervais-mortality.jpg',
            releaseDate: '2025-12-30',
            trailerUrl: 'https://www.youtube.com/watch?v=GBe-qmZ9weo'
        },
        {
            title: 'The Choral',
            query: 'The Choral',
            poster: 'posters/the-choral.jpg',
            releaseDate: '2025-12-25',
            trailerUrl: 'https://www.youtube.com/watch?v=6zRVP-ZgMm8'
        },
        {
            title: 'Space/Time',
            query: 'Space/Time',
            poster: 'posters/space-time.jpg',
            releaseDate: '2026-01-13',
            trailerUrl: 'https://www.youtube.com/watch?v=qA87_ceGoOg'
        },
        {
            title: 'The History of Sound',
            query: 'The History of Sound',
            poster: 'posters/the-history-of-sound.jpg',
            releaseDate: '2025-09-12',
            trailerUrl: 'https://www.youtube.com/watch?v=YfEYUoefwb8'
        },
        {
            title: 'The Strangers: Chapter 2',
            query: 'The Strangers: Chapter 2',
            poster: 'posters/the-strangers-chapter-2.jpg',
            releaseDate: '2025-09-26',
            trailerUrl: 'https://www.youtube.com/watch?v=Y3dXWFcoVqg'
        },
        {
            title: 'The Sound of Balloons 2',
            query: 'The Sound of Balloons 2',
            poster: 'posters/the-sound-of-balloons-2.jpg',
            releaseDate: '2025-06-21',
            trailerUrl: 'https://www.youtube.com/watch?v=yOiJBcxD6D0'
        },
        {
            title: 'Dead to Rights',
            query: 'Dead to Rights',
            poster: 'posters/dead-to-rights.jpg',
            releaseDate: '2025-08-15',
            trailerUrl: 'https://www.youtube.com/watch?v=_PX1WNbKdAE'
        },
        {
            title: 'Music Box: Happy and You Know It',
            query: 'Music Box: Happy and You Know It',
            poster: 'posters/music-box-happy-and-you-know-it.jpg',
            releaseDate: '2025-11-15',
            trailerUrl: 'https://www.youtube.com/watch?v=fZuvEvNeuFA'
        },
        {
            title: 'Not Without Hope',
            query: 'Not Without Hope',
            poster: 'posters/not-without-hope.jpg',
            releaseDate: '2025-12-12',
            trailerUrl: 'https://www.youtube.com/watch?v=rzDAcL3rOcU'
        },
        {
            title: 'Preparation for the Next Life',
            query: 'Preparation for the Next Life',
            poster: 'posters/preparation-for-the-next-life.jpg',
            releaseDate: '2025-09-05',
            trailerUrl: 'https://www.youtube.com/watch?v=d-LdHBuxCvs'
        },
        {
            title: 'P77',
            query: 'P77',
            poster: 'posters/p77.jpg',
            releaseDate: '2025-07-30',
            trailerUrl: 'https://www.youtube.com/watch?v=bVeOi_YNhd8'
        },
        {
            title: 'Nuremberg',
            query: 'Nuremberg',
            poster: 'posters/nuremberg.jpg',
            releaseDate: '2025-11-07',
            trailerUrl: 'https://www.youtube.com/watch?v=WvAy9C-bipY'
        },
        {
            title: 'Gladiator II',
            query: 'Gladiator II',
            poster: 'posters/gladiator-2.jpg',
            releaseDate: '2024-11-22',
            trailerUrl: 'https://www.youtube.com/watch?v=4rgYUipGJNo'
        },
        {
            title: 'Shell',
            query: 'Shell',
            poster: 'posters/shell.jpg',
            releaseDate: '2013-03-15',
            trailerUrl: 'https://www.youtube.com/watch?v=R6W6YzhRuTA'
        }
    ];

    const placeholderPoster =
        'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

    const renderRecentMovies = () => {
        if (!recentMoviesTrack) return;
        recentMoviesTrack.innerHTML = recentMovies
            .map((movie, index) => {
                const rating =
                    movie.imdbRating === 0 || movie.imdbRating
                        ? movie.imdbRating.toString()
                        : '—';
                const ratingLabelText = 'IMDb';
                const dateMarkup = movie.addedDate
                    ? `
                            <span class="movie-card__date">
                                <i class="far fa-calendar"></i>
                                <span class="movie-date__value">${movie.addedDate}</span>
                            </span>
                        `
                    : '';
                const releaseText = movie.releaseDate ? formatReleaseDate(movie.releaseDate) : '—';
                const posterSrc = movie.poster || placeholderPoster;
                return `
                <article class="movie-card" data-index="${index}">
                    <div class="movie-card__poster">
                        <img src="${posterSrc}" alt="Poster ${movie.title}" loading="lazy"
                            decoding="async" onerror="this.src='${placeholderPoster}'">
                        <button class="movie-card__play" type="button" data-trailer-index="${index}"
                            aria-label="Reda trailer pentru ${movie.title}">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    <div class="movie-card__body">
                        <h3 class="movie-card__title">${movie.title}</h3>
                        <div class="movie-card__meta">
                            <span class="movie-card__rating">
                                <i class="fas fa-star"></i>
                                <span class="movie-rating__value">${rating}</span>
                                <span class="movie-rating__label">${ratingLabelText}</span>
                            </span>
                            <span class="movie-card__release">
                                <i class="far fa-clock"></i>
                                <span class="movie-release__value">${releaseText}</span>
                            </span>
                            ${dateMarkup}
                        </div>
                    </div>
                </article>
            `;
            })
            .join('');
    };

    let recentSlideCount = 0;
    let recentCloneCount = 0;
    let recentCurrentIndex = 0;
    let recentIsRepositioning = false;
    let recentAutoTimer = null;
    let recentAutoResumeTimer = null;

    const prefersReducedMotion = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const getRecentSlideWidth = () => {
        if (!recentMoviesTrack) return 260;
        const slide = recentMoviesTrack.querySelector('.movie-card');
        if (!slide) return 260;
        const gap = parseFloat(getComputedStyle(recentMoviesTrack).gap) || 24;
        return slide.offsetWidth + gap;
    };

    const getRecentScrollForIndex = (index) => index * getRecentSlideWidth();

    const initRecentPosition = () => {
        if (!recentMoviesWindow) return;
        recentMoviesWindow.style.scrollBehavior = 'auto';
        recentMoviesWindow.scrollLeft = getRecentScrollForIndex(recentCloneCount);
        requestAnimationFrame(() => {
            recentMoviesWindow.style.scrollBehavior = '';
        });
    };

    const checkRecentBoundaries = () => {
        if (recentIsRepositioning || !recentMoviesWindow) return;
        const slideWidth = getRecentSlideWidth();
        const scrollLeft = recentMoviesWindow.scrollLeft;
        const cloneStartThreshold = (recentCloneCount - 1) * slideWidth;
        const cloneEndThreshold = (recentCloneCount + recentSlideCount) * slideWidth;
        const firstRealPosition = recentCloneCount * slideWidth;
        const lastRealPosition = (recentCloneCount + recentSlideCount - 1) * slideWidth;

        if (scrollLeft <= cloneStartThreshold) {
            recentIsRepositioning = true;
            const offset = scrollLeft - cloneStartThreshold;
            recentMoviesWindow.style.scrollBehavior = 'auto';
            recentMoviesWindow.scrollLeft = lastRealPosition + offset;
            recentCurrentIndex = recentCloneCount + recentSlideCount - 1;
            requestAnimationFrame(() => {
                recentMoviesWindow.style.scrollBehavior = '';
                recentIsRepositioning = false;
            });
        } else if (scrollLeft >= cloneEndThreshold) {
            recentIsRepositioning = true;
            const offset = scrollLeft - cloneEndThreshold;
            recentMoviesWindow.style.scrollBehavior = 'auto';
            recentMoviesWindow.scrollLeft = firstRealPosition + offset;
            recentCurrentIndex = recentCloneCount;
            requestAnimationFrame(() => {
                recentMoviesWindow.style.scrollBehavior = '';
                recentIsRepositioning = false;
            });
        }
    };

    const scrollRecentToIndex = (index, smooth = true) => {
        if (!recentMoviesWindow) return;
        recentCurrentIndex = index;
        recentMoviesWindow.scrollTo({
            left: getRecentScrollForIndex(index),
            behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto'
        });
    };

    const stopRecentAuto = () => {
        if (recentAutoTimer) {
            clearInterval(recentAutoTimer);
            recentAutoTimer = null;
        }
        if (recentAutoResumeTimer) {
            clearTimeout(recentAutoResumeTimer);
            recentAutoResumeTimer = null;
        }
    };

    const startRecentAuto = () => {
        if (prefersReducedMotion) return;
        stopRecentAuto();
        recentAutoTimer = setInterval(() => {
            scrollRecentToIndex(recentCurrentIndex + 1, true);
            setTimeout(checkRecentBoundaries, 360);
        }, 4200);
    };

    const scheduleRecentAuto = () => {
        if (prefersReducedMotion) return;
        stopRecentAuto();
        recentAutoResumeTimer = setTimeout(startRecentAuto, 5000);
    };

    const scrollRecentMoviesBy = (direction) => {
        stopRecentAuto();
        scrollRecentToIndex(recentCurrentIndex + direction, true);
        setTimeout(checkRecentBoundaries, 360);
        scheduleRecentAuto();
    };

    const setupRecentMoviesInfinite = () => {
        if (!recentMoviesTrack) return;
        const originalSlides = Array.from(recentMoviesTrack.children);
        recentSlideCount = originalSlides.length;
        if (recentSlideCount === 0) return;
        recentCloneCount = Math.min(3, recentSlideCount);

        for (let i = recentSlideCount - 1; i >= recentSlideCount - recentCloneCount; i--) {
            const clone = originalSlides[i].cloneNode(true);
            clone.classList.add('clone');
            clone.setAttribute('aria-hidden', 'true');
            clone.querySelectorAll('button').forEach((button) => {
                button.setAttribute('tabindex', '-1');
            });
            recentMoviesTrack.insertBefore(clone, recentMoviesTrack.firstChild);
        }

        for (let i = 0; i < recentCloneCount; i++) {
            const clone = originalSlides[i].cloneNode(true);
            clone.classList.add('clone');
            clone.setAttribute('aria-hidden', 'true');
            clone.querySelectorAll('button').forEach((button) => {
                button.setAttribute('tabindex', '-1');
            });
            recentMoviesTrack.appendChild(clone);
        }

        recentCurrentIndex = recentCloneCount;
        initRecentPosition();
    };

    if (recentMoviesPrev && recentMoviesNext) {
        recentMoviesPrev.addEventListener('click', () => scrollRecentMoviesBy(-1));
        recentMoviesNext.addEventListener('click', () => scrollRecentMoviesBy(1));
    }

    const formatReleaseDate = (releaseDate) => {
        if (!releaseDate) return '—';
        const parts = releaseDate.split('-');
        if (parts.length !== 3) return releaseDate;
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    };

    const trailerModal = document.getElementById('trailer-modal');
    const trailerFrame = trailerModal ? trailerModal.querySelector('iframe') : null;
    const trailerFallback = trailerModal ? trailerModal.querySelector('.trailer-modal__fallback') : null;

    const setTrailerFallback = (isVisible) => {
        if (!trailerFallback) return;
        trailerFallback.classList.toggle('visible', isVisible);
    };

    const closeTrailer = () => {
        if (!trailerModal) return;
        trailerModal.classList.remove('is-open');
        trailerModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (trailerFrame) {
            trailerFrame.src = '';
        }
        setTrailerFallback(false);
    };

    const openTrailer = async (movie) => {
        if (!trailerModal || !trailerFrame) return;
        trailerModal.classList.add('is-open');
        trailerModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (movie.trailerUrl) {
            setTrailerFallback(false);
            trailerFrame.src = movie.trailerUrl
                .replace('watch?v=', 'embed/')
                .replace('youtu.be/', 'www.youtube.com/embed/')
                .concat('?autoplay=1&rel=0');
            return;
        }
        setTrailerFallback(true);
    };

    if (trailerModal) {
        const closeButtons = trailerModal.querySelectorAll('[data-trailer-close]');
        closeButtons.forEach((button) => button.addEventListener('click', closeTrailer));
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && trailerModal.classList.contains('is-open')) {
                closeTrailer();
            }
        });
    }

    if (recentMoviesTrack) {
        renderRecentMovies();
        setupRecentMoviesInfinite();
        recentMoviesTrack.addEventListener('click', (event) => {
            const button = event.target.closest('.movie-card__play');
            if (!button) return;
            const index = Number(button.dataset.trailerIndex || '-1');
            const movie = recentMovies[index];
            if (!movie) return;
            openTrailer(movie);
        });
        if (recentMoviesWindow) {
            recentMoviesWindow.addEventListener('scroll', () => {
                if (!recentIsRepositioning) {
                    checkRecentBoundaries();
                }
                scheduleRecentAuto();
            }, { passive: true });
            recentMoviesWindow.addEventListener('pointerdown', () => {
                stopRecentAuto();
            });
            recentMoviesWindow.addEventListener('pointerup', scheduleRecentAuto);
            recentMoviesWindow.addEventListener('mouseenter', stopRecentAuto);
            recentMoviesWindow.addEventListener('mouseleave', scheduleRecentAuto);
            recentMoviesWindow.addEventListener('focusin', stopRecentAuto);
            recentMoviesWindow.addEventListener('focusout', scheduleRecentAuto);
        }
        window.addEventListener('resize', () => {
            if (!recentMoviesWindow) return;
            stopRecentAuto();
            initRecentPosition();
            scheduleRecentAuto();
        });
        startRecentAuto();
    }

    // WhatsApp chat interactions
    const whatsappBubble = document.getElementById('whatsapp-bubble');
    const whatsappWindow = document.getElementById('whatsapp-chat-window');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const sendMessageBtn = document.getElementById('send-whatsapp-message');
    const whatsappTextarea = document.getElementById('whatsapp-message');
    const whatsappNumber = '447449765468';
    const whatsappDefaultMessage = 'Salut! Sunt interesat de abonamentele Pixel Magix TV. Vreau sa aflu detalii si sa primesc un test gratuit de 24h. Multumesc!';

    const openWhatsAppWithMessage = (message = whatsappDefaultMessage) => {
        const finalMessage = (message || '').trim() || whatsappDefaultMessage;
        const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(finalMessage)}`;
        window.open(url, '_blank');
    };

    const whatsappLinks = document.querySelectorAll('a[href^="https://wa.me/447449765468"]:not(.js-whatsapp-plan)');
    const defaultWhatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappDefaultMessage)}`;

    whatsappLinks.forEach(link => {
        try {
            const url = new URL(link.href);
            url.searchParams.set('text', whatsappDefaultMessage);
            link.href = url.toString();
        } catch (error) {
            link.href = defaultWhatsappUrl;
        }
    });

    whatsappBubble?.addEventListener('click', () => {
        if (whatsappWindow) {
            whatsappWindow.style.display = 'flex';
            whatsappWindow.setAttribute('aria-hidden', 'false');
        }
    });

    closeChatBtn?.addEventListener('click', () => {
        if (whatsappWindow) {
            whatsappWindow.style.display = 'none';
            whatsappWindow.setAttribute('aria-hidden', 'true');
        }
    });

    sendMessageBtn?.addEventListener('click', () => {
        if (!whatsappTextarea) return;
        const message = whatsappTextarea.value.trim();
        if (message.length === 0) return;
        openWhatsAppWithMessage(message);
        whatsappTextarea.value = '';
        whatsappWindow?.setAttribute('aria-hidden', 'true');
        if (whatsappWindow) {
            whatsappWindow.style.display = 'none';
        }
    });

    const planButtons = document.querySelectorAll('.js-whatsapp-plan');

    planButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            const card = button.closest('.pricing-card');
            const planName = card?.querySelector('.plan-name')?.textContent.trim() || 'abonamentul Pixel Magix';
            const duration = card?.querySelector('.price-duration')?.textContent.trim() || '';
            const price = card?.querySelector('.price-value')?.textContent.trim() || '';
            const durationPart = duration ? ` (${duration})` : '';
            const pricePart = price ? ` la ${price}` : '';
            const message = `Salut! Vreau sa activez pachetul ${planName}${durationPart}${pricePart}. Imi puteti trimite detaliile si pasii de plata?`;
            openWhatsAppWithMessage(message);
        });
    });

    // Sidebar functionality
    const hamburger = document.querySelector('.hamburger');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');

    const openSidebar = () => {
        sidebar?.classList.add('active');
        overlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
        sidebar?.classList.remove('active');
        overlay?.classList.remove('active');
        document.body.style.overflow = '';
    };

    hamburger?.addEventListener('click', openSidebar);
    overlay?.addEventListener('click', closeSidebar);
    sidebar?.querySelector('.close-btn')?.addEventListener('click', closeSidebar);

    const mobileLinks = sidebar?.querySelectorAll('a[href^="#"]');
    mobileLinks?.forEach(link => {
        link.addEventListener('click', closeSidebar);
    });

    // Navbar scroll behaviour
    const navbar = document.querySelector('.navbar');
    const scrollToTopBtn = document.querySelector('.scroll-to-top');
    let lastScrollTop = 0;

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (navbar) {
            if (scrollTop > 60) {
                navbar.classList.add('navbar-scrolled');
            } else {
                navbar.classList.remove('navbar-scrolled');
            }

            if (scrollTop > lastScrollTop && scrollTop > 120) {
                navbar.classList.add('hidden');
            } else {
                navbar.classList.remove('hidden');
            }
        }

        if (scrollToTopBtn) {
            if (scrollTop > 480) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        }

        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    });

    scrollToTopBtn?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Smooth scroll for anchor links
    const navLinks = document.querySelectorAll('a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            const targetId = link.getAttribute('href');
            if (!targetId || targetId === '#') return;
            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;

            event.preventDefault();
            targetElement.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Highlight install card based on devices tap/click
    const installSection = document.getElementById('instalare');
    const installCards = document.querySelectorAll('.install-card[data-install]');
    const deviceLinks = document.querySelectorAll('.devices-logos a[data-install-target]');
    const highlightDuration = 1800;

    const clearInstallHighlights = () => {
        installCards.forEach(card => card.classList.remove('highlight-install'));
    };

    const highlightInstallCard = (card) => {
        clearInstallHighlights();
        card.classList.add('highlight-install');
        window.setTimeout(() => card.classList.remove('highlight-install'), highlightDuration);
    };

    deviceLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            const targetKey = link.dataset.installTarget;
            const targetCard = targetKey ? document.querySelector(`.install-card[data-install="${targetKey}"]`) : null;

            if (installSection) {
                event.preventDefault();
                installSection.scrollIntoView({ behavior: 'smooth' });
            }

            if (targetCard) {
                window.setTimeout(() => highlightInstallCard(targetCard), 240);
            }
        });
    });

    // Require at least one contact method in the form + send via EmailJS
    const contactForm = document.querySelector('.contact-form form');
    const phoneInput = document.getElementById('telefon');
    const emailInput = document.getElementById('email');
    const nameInput = document.getElementById('nume');
    const countryInput = document.getElementById('tara');
    const providerInput = document.getElementById('furnizor');
    const messageInput = document.getElementById('mesaj');
    const honeypotInput = document.getElementById('website');
    const statusBox = document.querySelector('.form-status');
    const statusIcon = statusBox ? statusBox.querySelector('i') : null;
    const submitButton = contactForm ? contactForm.querySelector('button[type=\"submit\"]') : null;
    const emailClient = window.emailjs;
    const emailConfig = {
        serviceId: 'service_orxx2ov',
        templateId: 'template_0knsbj1',
        publicKey: 'AyXyYZ2ZGPHEsL38U'
    };
    const phoneUtilsUrl = 'https://cdn.jsdelivr.net/npm/intl-tel-input@25.12.4/build/js/utils.js';

    const initPhoneInput = () => {
        if (!phoneInput || typeof window.intlTelInput !== 'function') {
            if (phoneInput) {
                console.warn('intl-tel-input nu este disponibil.');
            }
            return null;
        }

        return window.intlTelInput(phoneInput, {
            initialCountry: 'auto',
            geoIpLookup: (success) => {
                fetch('https://ipinfo.io/json?token=b4bd4c28b8a326')
                    .then((response) => response.json())
                    .then((data) => {
                        if (data && data.country) {
                            success(data.country.toLowerCase());
                        } else {
                            success('ro');
                        }
                    })
                    .catch(() => {
                        success('ro');
                    });
            },
            separateDialCode: true,
            nationalMode: true,
            showFlags: true,
            autoPlaceholder: 'aggressive',
            customPlaceholder: (selectedCountryPlaceholder) => `Ex. ${selectedCountryPlaceholder}`,
            formatAsYouType: true,
            countrySearch: true,
            countryOrder: ['ro', 'gb', 'it', 'es', 'de', 'fr', 'us', 'ca'],
            fixDropdownWidth: true,
            useFullscreenPopup: false,
            loadUtils: () => import(phoneUtilsUrl)
        });
    };

    const phoneIti = initPhoneInput();
    let phoneUtilsReady = false;
    if (phoneIti && phoneIti.promise) {
        phoneIti.promise.then(() => {
            phoneUtilsReady = true;
        }).catch(() => {
            phoneUtilsReady = false;
        });
    }

    const formatDate = () => {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    };

    if (emailClient && typeof emailClient.init === 'function') {
        emailClient.init({ publicKey: emailConfig.publicKey });
    } else {
        console.warn('EmailJS SDK nu a fost încărcat.');
    }

    if (contactForm && phoneInput && emailInput) {
        const getPhoneValue = () => {
            const rawValue = phoneInput.value.trim();
            if (rawValue.length === 0) return '';
            if (phoneIti && phoneUtilsReady && typeof phoneIti.getNumber === 'function') {
                const fullNumber = phoneIti.getNumber();
                return fullNumber || rawValue;
            }
            return rawValue;
        };

        const isPhoneValid = () => {
            const rawValue = phoneInput.value.trim();
            if (rawValue.length === 0) return false;
            if (phoneIti && phoneUtilsReady && typeof phoneIti.isValidNumber === 'function') {
                return phoneIti.isValidNumber();
            }
            return true;
        };

        const validateContactFields = () => {
            const hasPhone = phoneInput.value.trim().length > 0;
            const hasEmail = emailInput.value.trim().length > 0;
            const helperText = 'Completează numărul de telefon (cu prefix) sau adresa de email.';
            let phoneError = '';
            let emailError = '';

            if (!hasPhone && !hasEmail) {
                phoneError = helperText;
                emailError = helperText;
            } else if (hasPhone && !hasEmail && phoneIti && phoneUtilsReady && !isPhoneValid()) {
                phoneError = 'Numărul de telefon pare invalid.';
            }

            phoneInput.setCustomValidity(phoneError);
            emailInput.setCustomValidity(emailError);
        };

        const hideStatus = () => {
            if (!statusBox) return;
            statusBox.classList.remove('visible', 'error');
            statusBox.setAttribute('aria-hidden', 'true');
        };

        const showStatus = (message, isError = false) => {
            if (!statusBox) return;
            const textTarget = statusBox.querySelector('span');
            if (textTarget) {
                textTarget.textContent = message;
            } else {
                statusBox.textContent = message;
            }
            if (statusIcon) {
                statusIcon.className = isError ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
            }
            statusBox.classList.toggle('error', Boolean(isError));
            statusBox.classList.add('visible');
            statusBox.setAttribute('aria-hidden', 'false');
        };

        const setSendingState = (isSending) => {
            if (!submitButton) return;
            submitButton.disabled = isSending;
            submitButton.textContent = isSending ? 'Se trimite...' : 'Trimite mesajul';
        };

        phoneInput.addEventListener('input', () => {
            hideStatus();
            validateContactFields();
        });
        if (phoneIti) {
            phoneInput.addEventListener('countrychange', () => {
                hideStatus();
                validateContactFields();
            });
        }
        emailInput.addEventListener('input', () => {
            hideStatus();
            validateContactFields();
        });

        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            hideStatus();
            validateContactFields();

            if (!contactForm.checkValidity()) {
                contactForm.reportValidity();
                return;
            }

            if (honeypotInput && honeypotInput.value.trim().length > 0) {
                return;
            }

            if (!emailClient || typeof emailClient.send !== 'function') {
                showStatus('Serviciul de email nu este disponibil acum. Te rugăm să ne scrii pe WhatsApp.', true);
                return;
            }

            setSendingState(true);

            const templateParams = {
                nume: nameInput?.value.trim() || '',
                email: emailInput.value.trim(),
                telefon: getPhoneValue(),
                tara: countryInput?.value.trim() || '',
                provider: providerInput?.value.trim() || '',
                mesaj: messageInput?.value.trim() || '',
                date: formatDate()
            };

            try {
                await emailClient.send(emailConfig.serviceId, emailConfig.templateId, templateParams);
                showStatus('Mulțumim! Formularul a fost trimis. Revenim cât mai rapid.');
                contactForm.reset();
                if (phoneIti) {
                    phoneIti.setNumber('');
                }
                phoneInput.setCustomValidity('');
                emailInput.setCustomValidity('');
            } catch (error) {
                console.error('EmailJS error:', error);
                showStatus('Nu am putut trimite mesajul. Încearcă din nou sau contactează-ne pe WhatsApp.', true);
            } finally {
                setSendingState(false);
            }
        });
    }

    // Newsletter fake confirmation message
    const newsletterForm = document.querySelector('.newsletter-form');
    const newsletterInput = newsletterForm ? newsletterForm.querySelector('input[type="email"]') : null;
    const newsletterButton = newsletterForm ? newsletterForm.querySelector('button[type="submit"]') : null;
    const newsletterStatus = document.querySelector('.newsletter-status');
    let newsletterTimeout = null;

    if (newsletterForm && newsletterInput && newsletterButton && newsletterStatus) {
        const setNewsletterMessage = (message, type = 'success') => {
            newsletterStatus.textContent = message;
            newsletterStatus.classList.remove('success', 'error');
            newsletterStatus.classList.add(type, 'visible');
        };

        const setNewsletterSending = (isSending) => {
            newsletterButton.disabled = isSending;
            newsletterButton.innerHTML = isSending
                ? '<i class="fas fa-spinner fa-spin"></i>'
                : '<i class="fas fa-paper-plane"></i>';
        };

        newsletterForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const emailValue = newsletterInput.value.trim();
            if (newsletterTimeout) {
                clearTimeout(newsletterTimeout);
                newsletterTimeout = null;
            }

            if (emailValue.length === 0 || !emailValue.includes('@')) {
                setNewsletterMessage('Adaug\u0103 un email valid ca s\u0103 \u00eencheiem abonarea.', 'error');
                newsletterInput.focus();
                return;
            }

            setNewsletterMessage('Se proceseaz\u0103 abonarea...', 'success');
            setNewsletterSending(true);

            newsletterTimeout = window.setTimeout(() => {
                setNewsletterMessage('Gata! Am trimis o confirmare (demo) \u00een inbox. Mul\u021bumim!', 'success');
                newsletterForm.reset();
                setNewsletterSending(false);
            }, 900);
        });
    }

    // Set current year in footer
    const currentYear = document.getElementById('current-year');
    if (currentYear) {
        currentYear.textContent = new Date().getFullYear().toString();
    }
});
