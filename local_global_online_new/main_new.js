const jsPsych = initJsPsych({
    on_load: function() {
        jsPsych.getDisplayElement().innerHTML = '<p>読み込み中...</p>';
    }
});

async function startExperiment() {
    // ... (セッション情報取得などは変更なし) ...
    const timestamp = sessionStorage.getItem('experimentTimestamp') || 'unknown_timestamp';
    let experimentId_participant = sessionStorage.getItem('experimentId');
    let sessionNumber = sessionStorage.getItem('sessionNumber');
    const currentTaskIndex = parseInt(sessionStorage.getItem('currentTaskIndex'), 10);
    const overall_task_order = !isNaN(currentTaskIndex) ? currentTaskIndex + 1 : 'N/A';
    
    if (!experimentId_participant || !sessionNumber) {
        console.warn("セッション情報が見つかりません。単独テストモードで実行します。");
        experimentId_participant = jsPsych.randomization.randomID(10);
        sessionNumber = 'test_session_01';
    }

    const filename = `${sessionNumber}_${experimentId_participant}_${timestamp}_localglobal.csv`;
    const DATAPIPE_EXPERIMENT_ID = "MFu7dc3sEOCb";

    jsPsych.data.addProperties({
        experiment_timestamp: timestamp,
        experiment_id: experimentId_participant,
        session_number: sessionNumber,
        overall_task_order: overall_task_order
    });

    const stimuliData = await loadStimuliData();
    if (!stimuliData) {
        jsPsych.getDisplayElement().innerHTML = '<p>エラー: 課題ファイルの読み込みに失敗しました。ページを再読み込みしてください。</p>';
        return;
    }
    const timeline_variables = createTimelineVariables(stimuliData);
    const timeline = [];
    const preload = { /* ... */ };
    timeline.push(preload);

    const welcome = { /* ... */ };
    timeline.push(welcome);
    
    const instructions = { /* ... */ };
    timeline.push(instructions);
    const start_message = { /* ... */ };
    timeline.push(start_message);
    const blank_before_start = { /* ... */ };
    timeline.push(blank_before_start);

    const trial_procedure = { /* ... */ };
    timeline.push(trial_procedure);

    const save_data = {
        type: jsPsychPipe, action: "save", experiment_id: DATAPIPE_EXPERIMENT_ID, filename: filename,
        data_string: () => jsPsych.data.get().filter({task: 'response'}).csv()
    };
    timeline.push(save_data);

    const final_screen = { /* ... */ };
    timeline.push(final_screen);
    await jsPsych.run(timeline);
}

// ★★★ 修正点 1/2: ヘッダー名の変更 ★★★
async function loadStimuliData() {
    try {
        const response = await fetch('local_global_mixed.csv');
        const text = await response.text();
        const cleanedText = text.trim().replace(/^\uFEFF/, '');
        const lines = cleanedText.split('\n');
        // ヘッダーリストの 'cogruity' を 'congruency' に変更
        const headers = ['FrameType_mixed', 'stimulus_mixed', 'file_path_mixed', 'correct_answer_mixed', 'block_type_mixed', 'stimulus_number_mixed', 'congruency'];
        return lines.slice(1).map(line => {
            if (!line.trim()) return null;
            const values = line.split(',');
            let obj = {};
            headers.forEach((header, index) => { if (values[index]) obj[header] = values[index].trim(); });
            return obj;
        }).filter(Boolean);
    } catch (error) { console.error('CSVファイルの読み込みに失敗しました:', error); return null; }
}

// ★★★ 修正点 2/2: 変数名とデータプロパティ名の変更 ★★★
function createTimelineVariables(stimuliData) {
    const TOTAL_TRIALS = 43;
    const WARMUP_TRIALS = 3; 

    let timeline_vars = [];
    let lastStimulusNumber = null;

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    let main_trialtypes = Array(20).fill('switch').concat(Array(20).fill('repeat'));
    const shuffled_main_trialtypes = shuffleArray(main_trialtypes);
    let trialtypes = Array(WARMUP_TRIALS).fill('warmup').concat(shuffled_main_trialtypes);

    for (let i = 0; i < TOTAL_TRIALS; i++) {
        const trial_type = trialtypes[i];
        let selectedStimulus;

        if (i < WARMUP_TRIALS) {
            selectedStimulus = jsPsych.randomization.sampleWithoutReplacement(stimuliData, 1)[0];
        } 
        else {
            const isLastStimLocal = ['1', '2', '3', '4'].includes(lastStimulusNumber);
            let possibleStimuli = [];

            if (trial_type === "switch") {
                const targetGroup = isLastStimLocal ? ['5','6','7','8'] : ['1','2','3','4'];
                possibleStimuli = stimuliData.filter(s => targetGroup.includes(s.stimulus_number_mixed));
            } else { // 'repeat'
                const targetGroup = isLastStimLocal ? ['1','2','3','4'] : ['5','6','7','8'];
                possibleStimuli = stimuliData.filter(s => targetGroup.includes(s.stimulus_number_mixed));
            }
            selectedStimulus = jsPsych.randomization.sampleWithoutReplacement(possibleStimuli, 1)[0] || jsPsych.randomization.sampleWithoutReplacement(stimuliData, 1)[0];
        }
        
        lastStimulusNumber = selectedStimulus.stimulus_number_mixed;
        
        // 'cogruency' を 'congruency' に変更
        const { file_path_mixed, correct_answer_mixed, stimulus_number_mixed, stimulus_mixed, congruency } = selectedStimulus;

        let trial_type_value = (trial_type === 'repeat') ? 0 : (trial_type === 'switch' ? 1 : 'warmup');

        timeline_vars.push({
            file_path_mixed: file_path_mixed,
            data: {
                task: 'response',
                trial_type: trial_type, 
                trial_type_value: trial_type_value, 
                stimulus_path: file_path_mixed,
                stimulus_mixed: stimulus_mixed, 
                congruency: congruency, // 'cogruency' を 'congruency' に変更
                correct_answer: correct_answer_mixed, 
                stimulus_number: stimulus_number_mixed
            }
        });
    }
    return timeline_vars;
}
startExperiment();