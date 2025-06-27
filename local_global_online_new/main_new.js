const jsPsych = initJsPsych({
    on_load: function() {
        jsPsych.getDisplayElement().innerHTML = '<p>読み込み中...</p>';
    }
});

async function startExperiment() {
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
    const preload = {
        type: jsPsychPreload,
        images: [
            'stimulus/Blue_BIGH_h.png', 'stimulus/Blue_BIGH_s.png', 'stimulus/Blue_BIGS_h.png', 'stimulus/Blue_BIGS_s.png',
            'stimulus/Green_BIGH_h.png', 'stimulus/Green_BIGH_s.png', 'stimulus/Green_BIGS_h.png', 'stimulus/Green_BIGS_s.png',
            'stimulus/blank.png'
        ],
        message: '<p>課題の準備をしています。しばらくお待ちください...</p>'
    };
    timeline.push(preload);

    const welcome = { 
        type: jsPsychHtmlButtonResponse, 
        stimulus: `<div class='main-text'><h1 style="font-size: 7vw;"><span style="white-space: nowrap;">Local-Globalへ</span><br>ようこそ</h1></div>`, 
        choices: ['次へ'], 
        button_html: '<button class="jspsych-btn instruction-button">%choice%</button>', 
    };
    timeline.push(welcome);
    
    const instructions = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class='main-text' style='text-align: left; max-width: 90%;'>
                <p>画面に、SまたはHの文字が表示されます。</p>
                <p style="margin-top: 20px;">文字の色が<strong style='color: dodgerblue;'>青色</strong>の時は、<br>全体の<strong style='font-size: 1.2em;'>大きな文字</strong>が『S』か『H』かを答えてください。</p>
                <p style="margin-top: 20px;">文字の色が<strong style='color: mediumseagreen;'>緑色</strong>の時は、<br>構成要素の<strong style='font-size: 1.2em;'>小さな文字</strong>が『S』か『H』かを答えてください。</p>
                <br>
                <p>できるだけ素早く、正確に回答してください。</p>
            </div>`,
        choices: ['理解しました'], button_html: '<button class="jspsych-btn instruction-button">%choice%</button>',
    };
    timeline.push(instructions);
    const start_message = { type: jsPsychHtmlButtonResponse, stimulus: `<p style="font-size: 3rem;">スタート</p>`, choices: [], trial_duration: 2000 };
    timeline.push(start_message);
    const blank_before_start = { type: jsPsychHtmlButtonResponse, stimulus: '', choices: [], trial_duration: 500 };
    timeline.push(blank_before_start);

    const trial_procedure = {
        timeline: [
            { type: jsPsychImageButtonResponse, stimulus: 'stimulus/blank.png', stimulus_width: 1, choices: ['S', 'H'], button_html: '<button class="jspsych-btn response-button">%choice%</button>', trial_duration: 500, response_ends_trial: false, css_classes: ['no-stimulus-border'], on_load: () => document.querySelectorAll('.response-button').forEach(btn => btn.style.visibility = 'hidden') },
            {
                type: jsPsychImageButtonResponse,
                stimulus: jsPsych.timelineVariable('file_path_mixed'),
                choices: ['S', 'H'],
                button_html: '<button class="jspsych-btn response-button">%choice%</button>',
                trial_duration: 4000,
                data: jsPsych.timelineVariable('data'),
                on_finish: function(data) {
                    let response_key = null;
                    if (data.response === 0) response_key = '1';
                    if (data.response === 1) response_key = '2';
                    data.response_key = response_key;
                    data.is_correct = (response_key === data.correct_answer) ? 1 : 0;
                    if (data.is_correct === 0) data.feedback = 'X';
                }
            },
            { type: jsPsychImageButtonResponse, stimulus: 'stimulus/blank.png', stimulus_width: 1, choices: ['S', 'H'], button_html: '<button class="jspsych-btn response-button">%choice%</button>', trial_duration: 200, response_ends_trial: false, css_classes: ['no-stimulus-border'], prompt: () => `<p class="feedback-text">${jsPsych.data.get().last(1).values()[0].feedback || ''}</p>`, on_load: () => document.querySelectorAll('.response-button').forEach(btn => btn.style.visibility = 'hidden') }
        ],
        timeline_variables: timeline_variables
    };
    timeline.push(trial_procedure);

    const save_data = {
        type: jsPsychPipe, action: "save", experiment_id: DATAPIPE_EXPERIMENT_ID, filename: filename,
        data_string: () => jsPsych.data.get().filter({task: 'response'}).csv()
    };
    timeline.push(save_data);

    const final_screen = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class='main-text'><h1>お疲れ様でした</h1><p>データは正常に保存されました。</p><p id="final-message"></p></div>`,
        choices: [],
        on_load: function() {
            const finalMessage = document.getElementById('final-message');
            const taskOrder = JSON.parse(sessionStorage.getItem('taskOrder'));
            let currentTaskIndex = parseInt(sessionStorage.getItem('currentTaskIndex'), 10);
            if (!taskOrder || isNaN(currentTaskIndex)) {
                finalMessage.textContent = 'このウィンドウを閉じて終了してください。';
                return;
            }
            currentTaskIndex++;
            if (currentTaskIndex < taskOrder.length) {
                sessionStorage.setItem('currentTaskIndex', currentTaskIndex.toString());
                const nextTaskPath = taskOrder[currentTaskIndex];
                finalMessage.textContent = '2秒後に次の課題へ進みます...';
                setTimeout(() => { window.location.href = '../' + nextTaskPath; }, 2000);
            } else {
                finalMessage.textContent = 'すべての課題が終了しました。このウィンドウを閉じてください。';
                sessionStorage.clear();
            }
        }
    };
    timeline.push(final_screen);
    await jsPsych.run(timeline);
}

async function loadStimuliData() {
    try {
        const response = await fetch('local_global_mixed.csv');
        const text = await response.text();
        const cleanedText = text.trim().replace(/^\uFEFF/, '');
        const lines = cleanedText.split('\n');
        const headers = ['FrameType_mixed', 'stimulus_mixed', 'file_path_mixed', 'correct_answer_mixed', 'block_type_mixed', 'stimulus_number_mixed', 'cogruity'];
        return lines.slice(1).map(line => {
            if (!line.trim()) return null;
            const values = line.split(',');
            let obj = {};
            headers.forEach((header, index) => { if (values[index]) obj[header] = values[index].trim(); });
            return obj;
        }).filter(Boolean);
    } catch (error) { console.error('CSVファイルの読み込みに失敗しました:', error); return null; }
}

// ★★★ この関数が修正のメインです ★★★
function createTimelineVariables(stimuliData) {
    // 1. 試行回数の設定
    const TOTAL_TRIALS = 43; // ウォームアップ3回 + 本試行40回
    const WARMUP_TRIALS = 3; 

    let timeline_vars = [];
    let lastStimulusNumber = null;

    // 2. 本試行の条件リストを作成 (Switch 20回, Repeat 20回)
    let main_trialtypes = Array(20).fill('switch').concat(Array(20).fill('repeat'));
    jsPsych.randomization.shuffle(main_trialtypes);

    // 3. 全体の試行リストを作成 (ウォームアップ3回 + 本試行40回)
    let trialtypes = Array(WARMUP_TRIALS).fill('warmup').concat(main_trialtypes);

    // 4. 全43試行の刺激を生成
    for (let i = 0; i < TOTAL_TRIALS; i++) {
        const trial_type = trialtypes[i];
        let selectedStimulus;

        // ウォームアップ試行 (最初の3回)
        if (i < WARMUP_TRIALS) {
            selectedStimulus = jsPsych.randomization.sampleWithoutReplacement(stimuliData, 1)[0];
        } 
        // 本試行 (4回目以降)
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
            // 候補がない場合は全体からランダムに選ぶ（安全策）
            selectedStimulus = jsPsych.randomization.sampleWithoutReplacement(possibleStimuli, 1)[0] || jsPsych.randomization.sampleWithoutReplacement(stimuliData, 1)[0];
        }
        
        lastStimulusNumber = selectedStimulus.stimulus_number_mixed;
        
        // データ記録用のラベル
        let trial_type_value = (trial_type === 'repeat') ? 0 : (trial_type === 'switch' ? 1 : 'warmup');

        timeline_vars.push({
            file_path_mixed: selectedStimulus.file_path_mixed,
            data: {
                task: 'response',
                trial_type: trial_type, 
                trial_type_value: trial_type_value, 
                stimulus_path: selectedStimulus.file_path_mixed,
                stimulus_mixed: selectedStimulus.stimulus_mixed, 
                cogruity: selectedStimulus.cogruity,
                correct_answer: selectedStimulus.correct_answer_mixed, 
                stimulus_number: selectedStimulus.stimulus_number_mixed
            }
        });
    }
    return timeline_vars;
}
startExperiment();