
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

    const setActivePricingPlan = (plan) => {
        const targetGrid = document.getElementById(`${plan}-plans`);
        if (!targetGrid) return;

        toggleButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-plan') === plan);
        });

        pricingGrids.forEach(grid => {
            grid.classList.toggle('active', grid === targetGrid);
        });
    };

    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const plan = button.getAttribute('data-plan');
            if (!plan || button.classList.contains('active')) return;
            setActivePricingPlan(plan);
        });
    });

    // Local package finder recommendation
    const packageFinder = document.querySelector('.package-finder');
    const finderRegion = document.getElementById('finder-region');
    const finderDevice = document.getElementById('finder-device');
    const finderTier = document.getElementById('finder-tier');
    const finderResult = document.getElementById('package-finder-result');
    const finderApply = packageFinder?.querySelector('.package-finder__apply');

    const recommendationCopy = {
        'Standard 4 luni': 'Cel mai bun punct de pornire pentru canale românești și testare pe termen mediu.',
        'Standard 7 luni': 'Recomandat pentru familii care vor stabilitate mai mult timp, cu o lună bonus.',
        'VIP 4 luni': 'Cel mai echilibrat pachet pentru testare serioasă, calitate 4K și suport complet.',
        'VIP 8 luni': 'Recomandat pentru diaspora departe de țară: durată mai lungă, 4K și două luni bonus.'
    };

    const getPackageRecommendation = () => {
        const tier = finderTier?.value || 'vip';
        const region = finderRegion?.value || 'eu';
        const device = finderDevice?.value || 'smart-tv';
        const longerSetup = region === 'na' || device === 'android' || device === 'windows';

        if (tier === 'standard') {
            return longerSetup ? 'Standard 7 luni' : 'Standard 4 luni';
        }

        return longerSetup ? 'VIP 8 luni' : 'VIP 4 luni';
    };

    const clearRecommendedPlans = () => {
        document.querySelectorAll('.pricing-card--recommended').forEach(card => {
            card.classList.remove('pricing-card--recommended');
        });
    };

    const findPlanCard = (planName) => {
        const planNames = document.querySelectorAll('.plan-name');
        return Array.from(planNames).find(name => name.textContent.trim() === planName)?.closest('.pricing-card') || null;
    };

    const updatePackageFinder = () => {
        if (!finderResult) return null;
        const planName = getPackageRecommendation();
        const resultTitle = finderResult.querySelector('strong');
        const resultText = finderResult.querySelector('p');
        if (resultTitle) resultTitle.textContent = planName;
        if (resultText) resultText.textContent = recommendationCopy[planName] || recommendationCopy['VIP 4 luni'];
        return planName;
    };

    const applyPackageRecommendation = () => {
        const planName = updatePackageFinder();
        if (!planName) return;
        const tier = planName.toLowerCase().includes('standard') ? 'standard' : 'vip';
        setActivePricingPlan(tier);
        clearRecommendedPlans();

        const card = findPlanCard(planName);
        if (card) {
            card.classList.add('pricing-card--recommended');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    [finderRegion, finderDevice, finderTier].forEach(control => {
        control?.addEventListener('change', updatePackageFinder);
    });

    finderApply?.addEventListener('click', applyPackageRecommendation);
    updatePackageFinder();

    // Pricing feature expand/collapse
    document.querySelectorAll('.pricing-card').forEach(card => {
        const featureList = card.querySelector('.features-list');
        if (!featureList || featureList.children.length <= 5) return;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'pricing-details-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Vezi toate beneficiile';
        featureList.insertAdjacentElement('afterend', toggle);

        toggle.addEventListener('click', () => {
            const isExpanded = card.classList.toggle('is-expanded');
            toggle.setAttribute('aria-expanded', String(isExpanded));
            toggle.textContent = isExpanded ? 'Ascunde beneficiile extra' : 'Vezi toate beneficiile';
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

        const detectLocation = async () => checkHeuristic();

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
            title: 'Avatar',
            query: 'Avatar 2009',
            poster: 'https://image.tmdb.org/t/p/w780/gKY6q7SjCkAU6FqvqWybDYgUKIF.jpg',
            releaseDate: '2009-12-18',
            imdbRating: '7.9',
            trailerUrl: 'https://www.youtube.com/watch?v=5PSNL1qE6VY'
        },
        {
            title: 'Avengers: Endgame',
            query: 'Avengers: Endgame 2019',
            poster: 'https://image.tmdb.org/t/p/w780/ulzhLuWrPK07P1YkdWQLZnQh1JL.jpg',
            releaseDate: '2019-04-26',
            imdbRating: '8.4',
            trailerUrl: 'https://www.youtube.com/watch?v=TcMBFSGVi1c'
        },
        {
            title: 'Avatar: The Way of Water',
            query: 'Avatar: The Way of Water 2022',
            poster: 'https://image.tmdb.org/t/p/w780/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
            releaseDate: '2022-12-16',
            imdbRating: '7.5',
            trailerUrl: 'https://www.youtube.com/watch?v=d9MyW72ELq0'
        },
        {
            title: 'Titanic',
            query: 'Titanic 1997',
            poster: 'https://image.tmdb.org/t/p/w780/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg',
            releaseDate: '1997-12-19',
            imdbRating: '7.9',
            trailerUrl: 'https://www.youtube.com/watch?v=kVrqfYjkTdQ'
        },
        {
            title: 'Ne Zha 2',
            query: 'Ne Zha 2 2025',
            poster: 'https://image.tmdb.org/t/p/w780/cb5NyNrqiCNNoDkA8FfxHAtypdG.jpg',
            releaseDate: '2025-01-29',
            imdbRating: '7.1',
            trailerUrl: 'https://www.youtube.com/watch?v=nsXQijb0F4I'
        },
        {
            title: 'Star Wars: Episode VII - The Force Awakens',
            query: 'Star Wars: The Force Awakens 2015',
            poster: 'https://image.tmdb.org/t/p/w780/wqnLdwVXoBjKibFRR5U3y0aDUhs.jpg',
            releaseDate: '2015-12-18',
            imdbRating: '7.8',
            trailerUrl: 'https://www.youtube.com/watch?v=sGbxmsDFVnE'
        },
        {
            title: 'Avengers: Infinity War',
            query: 'Avengers: Infinity War 2018',
            poster: 'https://image.tmdb.org/t/p/w780/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg',
            releaseDate: '2018-04-27',
            imdbRating: '8.4',
            trailerUrl: 'https://www.youtube.com/watch?v=6ZfuNTqbHE8'
        },
        {
            title: 'Spider-Man: No Way Home',
            query: 'Spider-Man: No Way Home 2021',
            poster: 'https://image.tmdb.org/t/p/w780/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
            releaseDate: '2021-12-17',
            imdbRating: '8.2',
            trailerUrl: 'https://www.youtube.com/watch?v=JfVOs4VSpmA'
        },
        {
            title: 'Zootopia 2',
            query: 'Zootopia 2 2025',
            poster: 'https://image.tmdb.org/t/p/w780/oJ7g2CifqpStmoYQyaLQgEU32qO.jpg',
            releaseDate: '2025-11-26',
            imdbRating: 'TBD',
            trailerUrl: 'https://www.youtube.com/watch?v=sEgPQ7HKoBA'
        },
        {
            title: 'Inside Out 2',
            query: 'Inside Out 2 2024',
            poster: 'https://image.tmdb.org/t/p/w780/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg',
            releaseDate: '2024-06-14',
            imdbRating: '7.6',
            trailerUrl: 'https://www.youtube.com/watch?v=LEjhY15eCx0'
        },
        {
            title: 'Jurassic World',
            query: 'Jurassic World 2015',
            poster: 'https://image.tmdb.org/t/p/w780/rhr4y79GpxQF9IsfJItRXVaoGs4.jpg',
            releaseDate: '2015-06-12',
            imdbRating: '6.9',
            trailerUrl: 'https://www.youtube.com/watch?v=RFinNxS5KN4'
        },
        {
            title: 'The Lion King (2019)',
            query: 'The Lion King 2019',
            poster: 'https://image.tmdb.org/t/p/w780/dzBtMocZuJbjLOXvrl4zGYigDzh.jpg',
            releaseDate: '2019-07-19',
            imdbRating: '6.8',
            trailerUrl: 'https://www.youtube.com/watch?v=7TavVZMewpY'
        },
        {
            title: 'The Avengers',
            query: 'The Avengers 2012',
            poster: 'https://image.tmdb.org/t/p/w780/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg',
            releaseDate: '2012-05-04',
            imdbRating: '8.0',
            trailerUrl: 'https://www.youtube.com/watch?v=eOrNdBpGMv8'
        },
        {
            title: 'Furious 7',
            query: 'Furious 7 2015',
            poster: 'https://image.tmdb.org/t/p/w780/ktofZ9Htrjiy0P6LEowsDaxd3Ri.jpg',
            releaseDate: '2015-04-03',
            imdbRating: '7.1',
            trailerUrl: 'https://www.youtube.com/watch?v=Skpu5HaVkOc'
        },
        {
            title: 'Top Gun: Maverick',
            query: 'Top Gun: Maverick 2022',
            poster: 'https://image.tmdb.org/t/p/w780/62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
            releaseDate: '2022-05-27',
            imdbRating: '8.2',
            trailerUrl: 'https://www.youtube.com/watch?v=giXco2jaZ_4'
        },
        {
            title: 'Frozen II',
            query: 'Frozen II 2019',
            poster: 'https://image.tmdb.org/t/p/w780/mINJaa34MtknCYl5AjtNJzWj8cD.jpg',
            releaseDate: '2019-11-22',
            imdbRating: '6.8',
            trailerUrl: 'https://www.youtube.com/watch?v=Zi4LMpSDccc'
        },
        {
            title: 'Barbie',
            query: 'Barbie 2023',
            poster: 'https://image.tmdb.org/t/p/w780/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg',
            releaseDate: '2023-07-21',
            imdbRating: '6.8',
            trailerUrl: 'https://www.youtube.com/watch?v=pBk4NYhWNMM'
        },
        {
            title: 'Avengers: Age of Ultron',
            query: 'Avengers: Age of Ultron 2015',
            poster: 'https://image.tmdb.org/t/p/w780/4ssDuvEDkSArWEdyBl2X5EHvYKU.jpg',
            releaseDate: '2015-05-01',
            imdbRating: '7.3',
            trailerUrl: 'https://www.youtube.com/watch?v=tmeOjFno6Do'
        },
        {
            title: 'Avatar: Fire and Ash',
            query: 'Avatar: Fire and Ash 2025',
            poster: 'https://image.tmdb.org/t/p/w780/bRBeSHfGHwkEpImlhxPmOcUsaeg.jpg',
            releaseDate: '2025-12-19',
            imdbRating: 'TBD',
            trailerUrl: 'https://www.youtube.com/watch?v=nb_fFj_0rq8'
        },
        {
            title: 'The Super Mario Bros. Movie',
            query: 'The Super Mario Bros. Movie 2023',
            poster: 'https://image.tmdb.org/t/p/w780/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg',
            releaseDate: '2023-04-05',
            imdbRating: '7.0',
            trailerUrl: 'https://www.youtube.com/watch?v=KydqdKKyGEk'
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
                            decoding="async" draggable="false" onerror="this.src='${placeholderPoster}'">
                        <span class="movie-card__quality-badge">HD/4K</span>
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
    let recentIsDragging = false;
    let recentDragStartX = 0;
    let recentDragStartScrollLeft = 0;
    let recentHasDragged = false;
    let recentAutoTimer = null;
    let recentAutoResumeTimer = null;
    let recentIsAutoPaused = false;

    const recentAutoSpeed = 18;
    const recentAutoIntervalMs = 30;
    const recentAutoStepPx = (recentAutoSpeed * recentAutoIntervalMs) / 1000;

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

    const getNearestRecentIndex = () => {
        if (!recentMoviesWindow) return recentCloneCount;
        const slideWidth = getRecentSlideWidth();
        if (!slideWidth) return recentCloneCount;
        return Math.round(recentMoviesWindow.scrollLeft / slideWidth);
    };

    const syncRecentIndex = () => {
        recentCurrentIndex = getNearestRecentIndex();
    };

    const initRecentPosition = () => {
        if (!recentMoviesWindow) return;
        recentMoviesWindow.style.scrollBehavior = 'auto';
        recentMoviesWindow.scrollLeft = getRecentScrollForIndex(recentCloneCount);
        syncRecentIndex();
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
                syncRecentIndex();
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
                syncRecentIndex();
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

    const pauseRecentAuto = () => {
        recentIsAutoPaused = true;
        if (recentAutoResumeTimer) {
            clearTimeout(recentAutoResumeTimer);
            recentAutoResumeTimer = null;
        }
    };

    const startRecentAuto = () => {
        if (prefersReducedMotion || !recentMoviesWindow) return;
        if (recentAutoTimer) return;
        recentIsAutoPaused = false;
        recentAutoTimer = setInterval(() => {
            if (recentIsAutoPaused || recentIsDragging || recentIsRepositioning) return;
            recentMoviesWindow.scrollLeft += recentAutoStepPx;
            checkRecentBoundaries();
            syncRecentIndex();
        }, recentAutoIntervalMs);
    };

    const scheduleRecentAuto = (delay = 1000) => {
        if (prefersReducedMotion) return;
        if (recentAutoResumeTimer) {
            clearTimeout(recentAutoResumeTimer);
        }
        recentAutoResumeTimer = setTimeout(() => {
            recentIsAutoPaused = false;
            if (!recentAutoTimer) {
                startRecentAuto();
            }
        }, delay);
    };

    const scrollRecentMoviesBy = (direction) => {
        if (!recentMoviesWindow) return;
        pauseRecentAuto();
        const baseIndex = getNearestRecentIndex();
        scrollRecentToIndex(baseIndex + direction, true);
        setTimeout(() => {
            checkRecentBoundaries();
            syncRecentIndex();
        }, 380);
        scheduleRecentAuto(1200);
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

    const startRecentDrag = (event) => {
        if (!recentMoviesWindow) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (event.target.closest('.movie-card__play')) return;

        recentIsDragging = true;
        recentHasDragged = false;
        recentDragStartX = event.clientX;
        recentDragStartScrollLeft = recentMoviesWindow.scrollLeft;
        recentMoviesWindow.classList.add('is-grabbing');
        recentMoviesWindow.style.scrollBehavior = 'auto';
        pauseRecentAuto();

        if (typeof recentMoviesWindow.setPointerCapture === 'function') {
            recentMoviesWindow.setPointerCapture(event.pointerId);
        }
    };

    const moveRecentDrag = (event) => {
        if (!recentIsDragging || !recentMoviesWindow) return;
        const delta = event.clientX - recentDragStartX;
        if (!recentHasDragged && Math.abs(delta) > 3) {
            recentHasDragged = true;
        }

        recentMoviesWindow.scrollLeft = recentDragStartScrollLeft - delta;
        checkRecentBoundaries();
        syncRecentIndex();

        if (recentHasDragged) {
            event.preventDefault();
        }
    };

    const endRecentDrag = (event) => {
        if (!recentIsDragging || !recentMoviesWindow) return;
        recentIsDragging = false;
        recentMoviesWindow.classList.remove('is-grabbing');
        recentMoviesWindow.style.scrollBehavior = '';

        if (
            event &&
            typeof recentMoviesWindow.releasePointerCapture === 'function' &&
            typeof recentMoviesWindow.hasPointerCapture === 'function' &&
            recentMoviesWindow.hasPointerCapture(event.pointerId)
        ) {
            recentMoviesWindow.releasePointerCapture(event.pointerId);
        }

        if (recentHasDragged) {
            const targetIndex = getNearestRecentIndex();
            scrollRecentToIndex(targetIndex, true);
            setTimeout(() => {
                checkRecentBoundaries();
                syncRecentIndex();
            }, 380);
        }

        scheduleRecentAuto(recentHasDragged ? 1200 : 700);
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

    const getYoutubeEmbedUrl = (url) => {
        if (!url) return '';
        try {
            const parsedUrl = new URL(url);
            let videoId = '';

            if (parsedUrl.hostname.includes('youtu.be')) {
                videoId = parsedUrl.pathname.replace('/', '');
            } else if (parsedUrl.hostname.includes('youtube.com')) {
                videoId = parsedUrl.searchParams.get('v') || parsedUrl.pathname.split('/').filter(Boolean).pop() || '';
            }

            if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return '';
            return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
        } catch (error) {
            return '';
        }
    };

    const openTrailer = async (movie) => {
        if (!trailerModal || !trailerFrame) return;
        trailerModal.classList.add('is-open');
        trailerModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        const embedUrl = getYoutubeEmbedUrl(movie.trailerUrl);
        if (embedUrl) {
            setTrailerFallback(false);
            trailerFrame.src = embedUrl;
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
        recentMoviesTrack.addEventListener('dragstart', (event) => {
            event.preventDefault();
        });
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
                syncRecentIndex();
            }, { passive: true });
            recentMoviesWindow.addEventListener('pointerdown', startRecentDrag);
            recentMoviesWindow.addEventListener('pointermove', moveRecentDrag);
            ['pointerup', 'pointerleave', 'pointercancel'].forEach((eventType) => {
                recentMoviesWindow.addEventListener(eventType, endRecentDrag);
            });
            recentMoviesWindow.addEventListener('focusin', pauseRecentAuto);
            recentMoviesWindow.addEventListener('focusout', () => scheduleRecentAuto(700));
        }
        window.addEventListener('resize', () => {
            if (!recentMoviesWindow) return;
            syncRecentIndex();
            scrollRecentToIndex(recentCurrentIndex, false);
            checkRecentBoundaries();
            scheduleRecentAuto(300);
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
    const defaultPhoneCountry = (() => {
        try {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            return ['Europe/London', 'Europe/Belfast', 'Europe/Guernsey', 'Europe/Jersey', 'Europe/Isle_of_Man'].includes(timeZone) ? 'gb' : 'ro';
        } catch (error) {
            return 'ro';
        }
    })();

    const initPhoneInput = () => {
        if (!phoneInput || typeof window.intlTelInput !== 'function') {
            if (phoneInput) {
                console.warn('intl-tel-input nu este disponibil.');
            }
            return null;
        }

        return window.intlTelInput(phoneInput, {
            initialCountry: defaultPhoneCountry,
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
