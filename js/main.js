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
    let shuffledQuestions = [];
    let currentQuestionIndex = 0;
    let userScores = {};
    let traitChart = null; // To hold the chart instance
    let maxPossibleScores = {}; // To hold max scores for normalization
    const TRAITS = ["Pace", "Risk", "Interact", "Resource", "Presence", "Social"];
    const TRAIT_LABELS = {
        Pace: { left: 'Slow', right: 'Fast' },
        Risk: { left: 'Safe', right: 'Swingy' },
        Interact: { left: 'Proactive', right: 'Reactive' },
        Resource: { left: 'Efficient', right: 'Greedy' },
        Presence: { left: 'Subtle', right: 'Flashy' },
        Social: { left: 'Independent', right: 'Diplomatic' }
    };

    // Fetch data and then initialize
    $.when(
        $.getJSON('questions.json'),
        $.getJSON('archetypes.json')
    ).done(function(questionsData, archetypesData) {
        questions = questionsData[0];
        archetypes = archetypesData[0];
        maxPossibleScores = calculateMaxScores(questions);
        // Enable start button once data is loaded
        startBtn.prop('disabled', false).text('Start Quiz');
    }).fail(function() {
        // Handle error if JSON files fail to load
        introduction.html('<h2>Oops!</h2><p>Could not load quiz data. Please try refreshing the page.</p>');
    });

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
        userScores = TRAITS.reduce((acc, trait) => ({ ...acc, [trait]: 0 }), {});
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
                answerButtons.append(button);
            });
        } else {
            // End of quiz - transition to results
            // This will be implemented in the next step
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

        // Expose for testing
        window.userScores = userScores;

        const sortedResults = calculateResults();
        displayResults(sortedResults);
    }

    function calculateResults() {
        const normalizedPlayerScores = normalizeScores(userScores, maxPossibleScores);

        const results = archetypes.map(archetype => {
            let sumOfSquares = 0;
            TRAITS.forEach(trait => {
                const playerTraitScore = normalizedPlayerScores[trait];
                const archetypeTraitScore = archetype.fingerprint[trait];
                sumOfSquares += Math.pow(playerTraitScore - archetypeTraitScore, 2);
            });
            const distance = Math.sqrt(sumOfSquares);

            return {
                name: archetype.name,
                score: distance, // Score is now distance
                description: archetype.description
            };
        });

        // Sort by score (distance) in ascending order (lower is better)
        results.sort((a, b) => a.score - b.score);
        return results;
    }

    function displayResults(sortedResults) {
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

        const normalizedPlayerScores = normalizeScores(userScores, maxPossibleScores);
        renderTraitChart(normalizedPlayerScores);
        renderTraitBars(normalizedPlayerScores);
    }

    function renderTraitChart(normalizedScores) {
        const ctx = document.getElementById('trait-chart').getContext('2d');
        const chartData = {
            labels: TRAITS,
            datasets: [{
                label: 'Your Playstyle Scores',
                data: TRAITS.map(trait => normalizedScores[trait]),
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
                        angleLines: {
                            display: true,
                            color: '#ddd'
                        },
                        grid: {
                            color: '#ddd'
                        },
                        pointLabels: {
                            font: {
                                size: 14
                            },
                            color: '#333'
                        },
                        ticks: {
                            display: false,
                            min: 1,
                            max: 5,
                            stepSize: 4 // Creates grid lines at 1 and 5
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Hiding the legend as it's self-explanatory
                    }
                }
            }
        });
    }

    function renderTraitBars(normalizedScores) {
        const container = $('#trait-bars-container');
        container.find('.trait-bar-row').remove(); // Clear previous bars

        TRAITS.forEach(trait => {
            const score = normalizedScores[trait];
            const positionPercent = (score - 1) / 4 * 100;
            const labels = TRAIT_LABELS[trait];

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
                    <h4>${trait}</h4>
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

    function calculateMaxScores(allQuestions) {
        const maxScores = TRAITS.reduce((acc, trait) => ({ ...acc, [trait]: 0 }), {});

        allQuestions.forEach(question => {
            const questionMaxes = TRAITS.reduce((acc, trait) => ({ ...acc, [trait]: 0 }), {});

            question.answers.forEach(answer => {
                for (const trait in answer.scores) {
                    if (questionMaxes.hasOwnProperty(trait)) {
                        if (answer.scores[trait] > questionMaxes[trait]) {
                            questionMaxes[trait] = answer.scores[trait];
                        }
                    }
                }
            });

            for (const trait in maxScores) {
                maxScores[trait] += questionMaxes[trait];
            }
        });

        return maxScores;
    }

    function normalizeScores(scores, maxScores) {
        const normalizedScores = {};

        for (const trait in scores) {
            if (maxScores.hasOwnProperty(trait) && maxScores[trait] > 0) {
                // Apply formula: Normalized Value = 1 + 4 * (Score / Max Trait Score)
                normalizedScores[trait] = 1 + 4 * (scores[trait] / maxScores[trait]);
            } else {
                // Avoid division by zero, default to base score of 1
                normalizedScores[trait] = 1;
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
        // Assuming scores for each trait will be less than 100.
        // Pad with leading zero if needed to make each score 2 digits.
        return TRAITS.map(trait => String(scores[trait]).padStart(2, '0')).join('');
    }

    function decodeScores(encodedString) {
        const decodedScores = {};
        if (encodedString.length !== TRAITS.length * 2) {
            throw new Error("Invalid encoded string length.");
        }
        for (let i = 0; i < TRAITS.length; i++) {
            const trait = TRAITS[i];
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
            const data = hash.substring('#/results/'.length);
            try {
                userScores = decodeScores(data);

                // We need to make sure archetype data is loaded before calculating
                if (archetypes.length > 0) {
                    displayResultsFromScores();
                } else {
                    // If archetypes aren't loaded yet, wait for them.
                    // This relies on the initial $.when call
                    $.when($.getJSON('archetypes.json')).done(function(archetypesData) {
                        archetypes = archetypesData;
                        displayResultsFromScores();
                    });
                }
            } catch (e) {
                console.error("Failed to parse shared results data:", e);
                // Hide all content and show an error message
                introduction.addClass('hidden');
                quizContent.addClass('hidden');
                resultsContent.addClass('hidden');
                $('body').prepend('<div style="text-align: center; padding: 20px;"><h2>Invalid Share Link</h2><p>The link you followed seems to be broken. Please check the URL and try again.</p><a href="/">Go to Quiz</a></div>');
            }
        }
    }

    function displayResultsFromScores() {
        // Ensure max scores are calculated if they haven't been
        if (Object.keys(maxPossibleScores).length === 0) {
            maxPossibleScores = calculateMaxScores(questions);
        }

        if (traitChart) {
            traitChart.destroy();
        }

        const sortedResults = calculateResults();
        displayResults(sortedResults);

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
