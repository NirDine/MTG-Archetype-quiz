$(document).ready(function() {
    // Cached jQuery Selectors
    const introduction = $('#introduction');
    const quizContent = $('#quiz-content');
    const resultsContent = $('#results');
    const startBtn = $('#start-btn');
    const restartBtn = $('#restart-btn');
    const shareBtn = $('#share-btn');
    const questionText = $('#question-text');
    const answerButtons = $('#answer-buttons');
    const progressText = $('#progress-text');
    const progressBarInner = $('#progress-bar-inner');

    // State Variables
    let questions = [];
    let archetypes = [];
    let traitInfo = {};
    let traits = [];
    let shuffledQuestions = [];
    let currentQuestionIndex = 0;
    let userScores = {};
    let userSkewScores = {}; // For the hybrid model
    let traitChart = null; // To hold the chart instance
    let scoreRanges = {}; // To hold min/max scores for normalization

    // Fetch data and then initialize
    $.when(
        $.getJSON('questions.json'),
        $.getJSON('archetypes.json'),
        $.getJSON('traits.json')
    ).done(function(questionsData, archetypesData, traitsData) {
        questions = questionsData[0];
        archetypes = archetypesData[0];
        traitInfo = traitsData[0];

        traits = discoverTraits(archetypes, questions);
        scoreRanges = calculateScoreRanges(questions, traits);

        // Enable start button once data is loaded
        startBtn.prop('disabled', false).text('Start Quiz');
        // Check for shared results now that data is loaded
        checkForSharedResults();
    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.error("Failed to load JSON data:", textStatus, errorThrown);
        // Handle error if JSON files fail to load
        introduction.html('<h2>Oops!</h2><p>Could not load quiz data. Please try refreshing the page.</p>');
    });

    function discoverTraits(archetypes, questions) {
        const traitSet = new Set();
        archetypes.forEach(archetype => {
            Object.keys(archetype.fingerprint).forEach(trait => traitSet.add(trait));
        });
        questions.forEach(question => {
            question.answers.forEach(answer => {
                Object.keys(answer.scores).forEach(trait => traitSet.add(trait));
            });
        });
        return Array.from(traitSet).sort();
    }

    // Event Listeners
    startBtn.on('click', startQuiz);
    restartBtn.on('click', startQuiz); // Restart quiz functionality
    shareBtn.on('click', shareResults);
    answerButtons.on('click', 'button', selectAnswer);

    function startQuiz() {
        if (traitChart) {
            traitChart.destroy();
        }

        introduction.addClass('hidden');
        resultsContent.addClass('hidden');
        quizContent.removeClass('hidden');

        // Reset state
        currentQuestionIndex = 0;
        userScores = traits.reduce((acc, trait) => ({ ...acc, [trait]: 0 }), {});
        userSkewScores = {};
        shuffledQuestions = shuffleArray([...questions]);

        showNextQuestion();
    }

    function showNextQuestion() {
        if (currentQuestionIndex < shuffledQuestions.length) {
            updateProgressBar();
            const question = shuffledQuestions[currentQuestionIndex];
            questionText.text(question.question);
            answerButtons.empty();

            question.answers.forEach(answer => {
                const button = $('<button></button>').addClass('btn').text(answer.text);
                button.data('scores', answer.scores);
                if (answer.skew) {
                    button.data('skew', answer.skew);
                }
                answerButtons.append(button);
            });
        } else {
            endQuiz();
        }
    }

    function selectAnswer() {
        const selectedScores = $(this).data('scores');

        // Add scores to user's profile
        for (const trait in selectedScores) {
            if (userScores.hasOwnProperty(trait)) {
                userScores[trait] += selectedScores[trait];
            }
        }

        // Add skew scores, if any
        const selectedSkew = $(this).data('skew');
        if (selectedSkew) {
            for (const archetype in selectedSkew) {
                if (userSkewScores.hasOwnProperty(archetype)) {
                    userSkewScores[archetype] += selectedSkew[archetype];
                } else {
                    userSkewScores[archetype] = selectedSkew[archetype];
                }
            }
        }

        currentQuestionIndex++;
        showNextQuestion();
    }

    function updateProgressBar() {
        const progress = ((currentQuestionIndex) / shuffledQuestions.length) * 100;
        progressBarInner.css('width', `${progress}%`);
        progressText.text(`Question ${currentQuestionIndex + 1}/${shuffledQuestions.length}`);
    }

    function endQuiz() {
        quizContent.addClass('hidden');
        resultsContent.removeClass('hidden');

        const resultsData = calculateResults();
        displayResults(resultsData.sortedResults, resultsData.normalizedPlayerScores);
    }

    function calculateResults() {
        const normalizedPlayerScores = normalizeScores(userScores, scoreRanges);
        const SKEW_WEIGHT = 0.05; // How much to nudge the vector per skew point

        // --- Start of Hybrid Model Logic ---

        // 1. Get the base user vector from trait scores
        let baseUserVector = traits.map(trait => normalizedPlayerScores[trait] || 0);

        // 2. Calculate the total skew vector
        let totalSkewVector = traits.map(() => 0); // Initialize a zero vector
        for (const archetypeName in userSkewScores) {
            const skewValue = userSkewScores[archetypeName];
            const targetArchetype = archetypes.find(a => a.name === archetypeName);

            if (targetArchetype) {
                // Get the trait vector for the archetype we are skewing towards
                const targetArchetypeVector = traits.map(trait => {
                    const rawScore = targetArchetype.fingerprint[trait] || 3;
                    return (rawScore - 3) * 50; // Normalize from 1-5 to -100-100
                });

                // Add the weighted archetype vector to the total skew vector
                for (let i = 0; i < traits.length; i++) {
                    totalSkewVector[i] += targetArchetypeVector[i] * skewValue * SKEW_WEIGHT;
                }
            }
        }

        // 3. Create the final, skewed user vector
        const finalUserVector = baseUserVector.map((val, i) => val + totalSkewVector[i]);

        // --- End of Hybrid Model Logic ---


        // Helper function for dot product of two vectors
        const dotProduct = (vecA, vecB) => vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);

        // Helper function for vector magnitude (length)
        const magnitude = (vec) => Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));

        const playerMagnitude = magnitude(finalUserVector);

        const results = archetypes.map(archetype => {
            const archetypeVector = traits.map(trait => {
                const rawArchetypeScore = archetype.fingerprint[trait] || 3;
                return (rawArchetypeScore - 3) * 50; // Normalize from 1-5 to -100-100
            });

            const archetypeMagnitude = magnitude(archetypeVector);

            let similarity = 0;
            // To avoid division by zero, only calculate if both vectors have non-zero length
            if (playerMagnitude > 0 && archetypeMagnitude > 0) {
                similarity = dotProduct(finalUserVector, archetypeVector) / (playerMagnitude * archetypeMagnitude);
            }

            return {
                name: archetype.name,
                score: similarity, // Score is now similarity (higher is better)
                description: archetype.description
            };
        });

        // Sort by similarity score in DESCENDING order
        results.sort((a, b) => b.score - a.score);
        // Note: We return the *original* normalized scores for display, not the skewed ones.
        return { sortedResults: results, normalizedPlayerScores: normalizedPlayerScores };
    }

    function displayResults(sortedResults, normalizedPlayerScores) {
        if (!sortedResults || sortedResults.length === 0) {
            $('#primary-name').text("Could not determine archetype.");
            $('#primary-description').text("Please try the quiz again.");
            return;
        }

        const primary = sortedResults[0];
        const secondaries = sortedResults.slice(1, 4);

        $('#primary-name').text(primary.name);
        $('#primary-description').text(primary.description);

        const secondaryList = $('#secondary-list');
        secondaryList.empty();
        secondaries.forEach(archetype => {
            secondaryList.append(`<li>${archetype.name}</li>`);
        });

        renderTraitChart(normalizedPlayerScores);
        renderTraitBars(normalizedPlayerScores);
    }

    function renderTraitChart(normalizedScores) {
        const ctx = document.getElementById('trait-chart').getContext('2d');
        const chartData = {
            labels: traits,
            datasets: [{
                label: 'Your Playstyle Scores',
                data: traits.map(trait => normalizedScores[trait] || 0), // Default to 0 for neutral
                backgroundColor: 'rgba(106, 106, 255, 0.2)',
                borderColor: 'rgba(106, 106, 255, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(106, 106, 255, 1)'
            }]
        };

        traitChart = new Chart(ctx, {
            type: 'radar',
            data: chartData,
            options: {
                scales: {
                    r: {
                        angleLines: { display: true, color: '#ddd' },
                        grid: {
                            color: context => {
                                // Only show the outermost grid line
                                if (context.tick.value === 100) {
                                    return '#ddd'; // Border color for the outer line
                                }
                                return 'transparent'; // No color for inner lines
                            }
                        },
                        pointLabels: { font: { size: 14 }, color: '#333' },
                        min: -100,
                        max: 100,
                        ticks: {
                            display: false, // Hide the numbered labels
                            stepSize: 50
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    function renderTraitBars(normalizedScores) {
        const container = $('#trait-bars-container');
        container.empty(); // Clear previous bars more robustly

        traits.forEach(trait => {
            const score = normalizedScores[trait] || 0; // Default to neutral 0
            // Convert score from -100 to 100 range to 0% to 100% for the bar
            const positionPercent = (score + 100) / 2;

            const info = traitInfo[trait] || {};
            const labels = info.labels || { left: 'Low', right: 'High' };
            const description = info.description || 'No description available.';

            let trailLeft, trailWidth;
            if (positionPercent >= 50) {
                trailLeft = 50;
                trailWidth = positionPercent - 50;
            } else {
                trailLeft = positionPercent;
                trailWidth = 50 - positionPercent;
            }

            const barHtml = `
                <div class="trait-bar-row">
                    <div class="trait-header">
                        <h4>${trait}</h4>
                        <div class="tooltip">
                            <span class="tooltip-icon">?</span>
                            <div class="tooltip-content">
                                <p>${description}</p>
                            </div>
                        </div>
                    </div>
                    <div class="bar-track">
                        <div class="bar-trail" style="left: ${trailLeft}%; width: ${trailWidth}%;"></div>
                        <div class="bar-indicator" style="left: ${positionPercent}%;"></div>
                    </div>
                    <div class="bar-labels">
                        <span class="label-left">${labels.left}</span>
                        <span class="label-right">${labels.right}</span>
                    </div>
                </div>
            `;
            container.append(barHtml);
        });
    }

    function calculateScoreRanges(allQuestions, allTraits) {
        const ranges = {};
        allTraits.forEach(trait => {
            ranges[trait] = { min: 0, max: 0 };
        });

        allQuestions.forEach(question => {
            allTraits.forEach(trait => {
                const scoresForTrait = question.answers.map(a => a.scores[trait] || 0);
                const minInQuestion = Math.min(...scoresForTrait);
                const maxInQuestion = Math.max(...scoresForTrait);

                ranges[trait].min += minInQuestion;
                ranges[trait].max += maxInQuestion;
            });
        });

        // Round to avoid floating point inaccuracies
        for (const trait in ranges) {
            ranges[trait].min = Math.round(ranges[trait].min * 100) / 100;
            ranges[trait].max = Math.round(ranges[trait].max * 100) / 100;
        }

        return ranges;
    }

    function normalizeScores(scores, ranges) {
        const normalizedScores = {};

        for (const trait of traits) {
            const rawScore = scores[trait] || 0;
            const range = ranges[trait];

            if (range && (range.max - range.min) > 0) {
                const S_min = range.min;
                const S_max = range.max;

                // Scale the raw score to a -100 to 100 range
                const normalized = -100 + 200 * (rawScore - S_min) / (S_max - S_min);

                normalizedScores[trait] = Math.round(normalized);
            } else {
                // If range is zero or invalid, the score is neutral
                normalizedScores[trait] = 0;
            }
        }

        return normalizedScores;
    }

    // Fisher-Yates Shuffle Algorithm
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function encodeScores(scores) {
        // Pad with leading zero if needed to make each score 2 digits.
        return traits.map(trait => String(scores[trait] || 0).padStart(2, '0')).join('');
    }

    function decodeScores(encodedString) {
        const decodedScores = {};
        if (encodedString.length !== traits.length * 2) {
            // Can't reliably decode if length doesn't match, could be old URL
            console.error("Decoded string length doesn't match current trait count.");
            throw new Error("Invalid encoded string length.");
        }
        for (let i = 0; i < traits.length; i++) {
            const trait = traits[i];
            const scoreStr = encodedString.substring(i * 2, (i * 2) + 2);
            decodedScores[trait] = parseInt(scoreStr, 10);
        }
        return decodedScores;
    }

    function shareResults() {
        const data = encodeScores(userScores);
        const url = window.location.origin + window.location.pathname + '#/results/' + data;

        navigator.clipboard.writeText(url).then(() => {
            const originalText = shareBtn.text();
            shareBtn.text('Copied!');
            setTimeout(() => {
                shareBtn.text(originalText);
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy URL: ', err);
            alert('Failed to copy URL. Please copy it manually:\n' + url);
        });
    }

    function checkForSharedResults() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#/results/')) {
            // Can only process this after traits are discovered
            if (traits.length === 0) {
                console.log("Traits not discovered yet, deferring shared results check.");
                return;
            }
            const data = hash.substring('#/results/'.length);
            try {
                userScores = decodeScores(data);
                displayResultsFromScores();
            } catch (e) {
                console.error("Failed to parse shared results data:", e);
                introduction.addClass('hidden');
                quizContent.addClass('hidden');
                resultsContent.addClass('hidden');
                $('body').prepend('<div style="text-align: center; padding: 20px;"><h2>Invalid Share Link</h2><p>The link you followed seems to be broken or from a previous version of the quiz.</p><a href="/">Go to Quiz</a></div>');
            }
        }
    }

    function displayResultsFromScores() {
        // Ensure score ranges are calculated if they haven't been
        if (Object.keys(scoreRanges).length === 0) {
            scoreRanges = calculateScoreRanges(questions, traits);
        }

        if (traitChart) {
            traitChart.destroy();
        }

        const resultsData = calculateResults();
        displayResults(resultsData.sortedResults, resultsData.normalizedPlayerScores);

        // Show results and hide other sections
        introduction.addClass('hidden');
        quizContent.addClass('hidden');
        resultsContent.removeClass('hidden');
    }

    // Initially disable start button until data is loaded
    startBtn.prop('disabled', true).text('Loading...');

    // Check for shared results on page load
    checkForSharedResults();
});
