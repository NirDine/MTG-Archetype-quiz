$(document).ready(function() {
    // Cached jQuery Selectors
    const introduction = $('#introduction');
    const quizContent = $('#quiz-content');
    const resultsContent = $('#results');
    const startBtn = $('#start-btn');
    const restartBtn = $('#restart-btn');
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

        renderTraitChart(userScores);
    }

    function renderTraitChart(scores) {
        const normalizedScores = normalizeScores(scores, maxPossibleScores);
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

    // Initially disable start button until data is loaded
    startBtn.prop('disabled', true).text('Loading...');
});
