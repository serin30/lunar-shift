/* LUNAR//SHIFT - English and Korean text.
   AI disclosure: drafted with an AI coding assistant (Claude); reviewed by the team. */
(function () {
  'use strict';
  var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  var en = {
    day: function (t) { return t.getUTCDate() + ' ' + M[t.getUTCMonth()] + ' ' + t.getUTCFullYear(); },
    short: function (t) { return t.getUTCDate() + ' ' + M[t.getUTCMonth()]; },
    clock: function (t) { return p2(t.getUTCDate()) + ' ' + M[t.getUTCMonth()] + ' ' + t.getUTCFullYear() + '  ' + p2(t.getUTCHours()) + ':' + p2(t.getUTCMinutes()); },
    month: function (m) { return M[m]; },
    pt_target: 'Target point', pt_best: function (d) { return 'Best spot nearby (' + d + ' m away)'; },
    days: function (n) { return n + (n === 1 ? ' day' : ' days'); }, h: function (n) { return n + ' h'; }, none: 'none', not_needed: 'not needed',
    v_go: 'GO', v_hold: 'MARGINAL', v_no: 'NO-GO', v_na: 'NO VERDICT', n_go: 'Go', n_hold: 'Marginal', n_no: 'No-go', n_na: 'No verdict',
    mean_go: 'Safe to plan on. It works even when we assume the worst about the light.', mean_hold: 'Too close to plan on. It works only if the light is a little better than our careful estimate.',
    mean_no: 'Do not land on this date. It fails even on our most generous estimate.', mean_na: '',
    v_date: function (date, stay, label) { return 'Land ' + date + ' 00:00 UTC, stay ' + stay + ' at the ' + label.toLowerCase(); },
    count: function (go, hold, total) { return go + ' go, ' + hold + ' marginal, of ' + total; },
    darklim: function (h) { return h === 0 ? 'no dark gap is allowed' : 'the limit is ' + h + ' h'; },
    why_na: 'The stay would run past the end of our 2027 data, so we do not give a verdict.',
    why_go: function (dark, limit, need, contact) {
      return (dark === 0 ? 'More than half of the Sun stays above the terrain for the whole stay' : 'The longest dark gap is ' + dark + ' h, within the ' + limit + ' h limit') +
        (need > 0 ? ', and Earth is in view at least ' + contact + ' h every day.' : '.') + ' This holds even on the careful estimate.';
    },
    hold_dark: function (dark, lim) { return 'if only half-visible Sun counts, the longest dark gap is ' + dark + ' h and ' + lim; },
    hold_contact: function (c, need) { return 'if Earth must clear the terrain by half a degree, the worst day has ' + c + ' h of contact and ' + need + ' h are needed'; },
    hold_wrap: function (s) { return 'It passes only on the generous estimate: ' + s + '. We show the careful colour.'; },
    no_dark: function (dark, lim) { return 'the Sun is hidden for ' + dark + ' h in a row and ' + lim; },
    no_contact: function (c, need) { return 'Earth is in view only ' + c + ' h on the worst day and ' + need + ' h are needed'; },
    no_wrap: function (s) { return 'It fails even on the generous estimate: ' + s + '.'; },
    slip_next: function (d) { return 'none. Next date that passes: ' + d; }, slip_never: 'none. No later date in 2027 passes',
    slip_zero: '0 days. One day late and it fails', slip_n: function (n, d) { return n + (n === 1 ? ' day' : ' days') + ' (last good landing ' + d + ')'; },
    hidden: 'hidden', in_view: 'in view', km_away: function (x) { return x + ' km away'; },
    dur: function (d, h) { return (d ? d + ' d ' : '') + h + ' h'; },
    sets_in: function (dur, date) { return 'sets in ' + dur + ' (' + date + ')'; }, rises_in: function (dur, date) { return 'rises in ' + dur + ' (' + date + ')'; },
    stays_up: 'stays up to the end of 2027', stays_down: 'stays down to the end of 2027',
    note_stand: 'You are standing at the site, eyes 2 m above the ground, looking toward the Sun. The dark band is the far skyline we computed. Sun and Earth are at true size. Drag to look around.',
    note_real: 'Real Sun: light and shadows for the selected time, from the terrain shown. True scale; Sun and Earth markers enlarged.',
    note_survey: 'The real terrain around the site, from the NASA LOLA elevation map, at true scale. Colours are our results for every 160 m. Drag to rotate, scroll to zoom, click any spot to read its numbers.',
    cap_crew_go: 'Crew landing dates in 2027 that are a go at each spot', cap_robot_go: 'Robot landing dates in 2027 that are a go at each spot',
    cap_sun_pct: 'Share of 2027 with sunlight at each spot', cap_earth_pct: 'Share of 2027 with Earth above the terrain',
    unit_dates: ' dates', legend_cap: function (cap, pct, km) { return cap + '. ' + pct + '% of this ' + km + ' km square has more than zero.'; },
    miss_lead: function (d, a, b, n, sp) { return 'Moving ' + d + ' m changes sunlight over the year from ' + a + '% to ' + b + '%. Each square is a real calculation at that spot: ' + n + ' points, ' + sp + ' m apart.'; },
    stat_target: 'Sunlight at the target', stat_best: function (d) { return 'Best spot, ' + d + ' m away'; }, stat_range: 'Range within 250 m', stat_worst: function (d) { return 'Worst spot, ' + d + ' m away'; },
    range: function (a, b) { return a + ' to ' + b; },
    tip: function (s, e, sl, d) { return 'sunlight ' + s + '%<br>Earth in view ' + e + '%<br>slope ' + sl + '°<br>' + d + ' m from target'; },
    map_ring: 'ring: 250 m from target', map_key: 'white: target   green: best spot',
    proof_best: function (p, d) { return p + '% (' + d + ' m from the target)'; },
    cmp_head: ['Site', 'Landing dates that pass, target', 'Best spot nearby', 'Sunlight, target / best', 'Earth in view', 'Longest dark stretch'],
    cmp_cell: function (go, hold) { return go + ' go, ' + hold + ' marginal'; }, not_computed: 'not computed',
    pick_title: 'The spot you clicked', pick_where: function (d, dir, up) { return d + ' ' + dir + ' of the target, ' + up + ' in height'; },
    compass: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
    pick_sun: 'Sunlight over 2027', pick_earth: 'Earth in view', pick_dark: 'Longest dark stretch', pick_crew: 'Crew landing dates', pick_robot: 'Robot landing dates',
    pick_outside: function (km) { return 'Outside the ' + km + ' km square we computed. Click closer to the target.'; },
    sun: 'Sun', earth: 'Earth', play: 'Play', pause: 'Pause',
    tour: [
      'The real south pole of the Moon, from NASA\'s LOLA elevation map. This is how low the Sun really is.',
      'Green: a crew could land there on at least one date in 2027. Grey: never.',
      'From the ground, eyes 2 m up: the Sun skims the skyline, then slips behind it.'
    ]
  };

  var ko = {
    day: function (t) { return t.getUTCFullYear() + '년 ' + (t.getUTCMonth() + 1) + '월 ' + t.getUTCDate() + '일'; },
    short: function (t) { return (t.getUTCMonth() + 1) + '월 ' + t.getUTCDate() + '일'; },
    clock: function (t) { return t.getUTCFullYear() + '.' + p2(t.getUTCMonth() + 1) + '.' + p2(t.getUTCDate()) + '  ' + p2(t.getUTCHours()) + ':' + p2(t.getUTCMinutes()); },
    month: function (m) { return (m + 1) + '월'; },
    pt_target: '목표 지점', pt_best: function (d) { return '근처 최적 지점 (' + d + 'm 거리)'; },
    days: function (n) { return n + '일'; }, h: function (n) { return n + '시간'; }, none: '허용 안 함', not_needed: '필요 없음',
    v_go: '가능', v_hold: '주의', v_no: '불가', v_na: '판정 없음', n_go: '가능', n_hold: '주의', n_no: '불가', n_na: '판정 없음',
    mean_go: '계획해도 됩니다. 빛 조건을 가장 나쁘게 잡아도 통과합니다.', mean_hold: '계획하기엔 아슬아슬합니다. 빛 조건이 신중한 추정보다 조금 좋아야만 통과합니다.',
    mean_no: '이 날짜에는 착륙하면 안 됩니다. 가장 너그럽게 잡아도 실패합니다.', mean_na: '',
    v_date: function (date, stay, label) { return date + ' 00:00 UTC 착륙, ' + stay + ' 체류, ' + label; },
    count: function (go, hold, total) { return '가능 ' + go + '일, 주의 ' + hold + '일 / 전체 ' + total + '일'; },
    darklim: function (h) { return h === 0 ? '어둠은 허용되지 않습니다' : '한계는 ' + h + '시간입니다'; },
    why_na: '체류 기간이 2027년 데이터 범위를 벗어나 판정하지 않습니다.',
    why_go: function (dark, limit, need, contact) {
      return (dark === 0 ? '체류 기간 내내 태양의 절반 이상이 지형 위에 있습니다' : '가장 긴 어둠은 ' + dark + '시간으로, 한계 ' + limit + '시간 이내입니다') +
        (need > 0 ? '. 지구는 매일 최소 ' + contact + '시간 보입니다.' : '.') + ' 신중한 추정으로도 통과합니다.';
    },
    hold_dark: function (dark, lim) { return '태양이 절반 이상 보일 때만 햇빛으로 치면 가장 긴 어둠이 ' + dark + '시간인데 ' + lim; },
    hold_contact: function (c, need) { return '지구가 지형보다 0.5° 이상 높아야 한다면 가장 나쁜 날의 통신은 ' + c + '시간인데 ' + need + '시간이 필요합니다'; },
    hold_wrap: function (s) { return '너그러운 추정에서만 통과합니다: ' + s + '. 그래서 더 조심스러운 색으로 표시합니다.'; },
    no_dark: function (dark, lim) { return '태양이 ' + dark + '시간 연속으로 가려지는데 ' + lim; },
    no_contact: function (c, need) { return '가장 나쁜 날 지구가 ' + c + '시간만 보이는데 ' + need + '시간이 필요합니다'; },
    no_wrap: function (s) { return '너그러운 추정으로도 실패합니다: ' + s + '.'; },
    slip_next: function (d) { return '없음. 다음 통과 날짜: ' + d; }, slip_never: '없음. 2027년에 이후 통과 날짜가 없습니다',
    slip_zero: '0일. 하루만 늦어도 실패합니다', slip_n: function (n, d) { return n + '일 (마지막 가능 착륙일 ' + d + ')'; },
    hidden: '가려짐', in_view: '보임', km_away: function (x) { return x + 'km 거리'; },
    dur: function (d, h) { return (d ? d + '일 ' : '') + h + '시간'; },
    sets_in: function (dur, date) { return dur + ' 뒤 짐 (' + date + ')'; }, rises_in: function (dur, date) { return dur + ' 뒤 뜸 (' + date + ')'; },
    stays_up: '2027년 말까지 떠 있음', stays_down: '2027년 말까지 뜨지 않음',
    note_stand: '착륙지에 서서 지면 2m 높이에서 태양 쪽을 보고 있습니다. 어두운 띠는 우리가 계산한 먼 지평선입니다. 태양과 지구는 실제 크기입니다. 드래그해서 둘러보세요.',
    note_real: '실제 태양: 선택한 시각의 빛과 그림자입니다. 실제 비율이며, 태양과 지구 표시는 확대했습니다.',
    note_survey: 'NASA LOLA 고도 지도로 만든 착륙지 주변의 실제 지형입니다(실제 비율). 색은 160m마다 계산한 우리의 결과입니다. 드래그로 회전, 스크롤로 확대, 지면을 클릭하면 그 지점의 숫자가 나옵니다.',
    cap_crew_go: '각 지점에서 2027년에 유인 착륙이 가능한 날짜 수', cap_robot_go: '각 지점에서 2027년에 로봇 착륙이 가능한 날짜 수',
    cap_sun_pct: '각 지점에서 2027년 중 햇빛이 드는 시간 비율', cap_earth_pct: '2027년 중 지구가 지형 위에 보이는 시간 비율',
    unit_dates: '일', legend_cap: function (cap, pct, km) { return cap + '. 이 ' + km + 'km 정사각형의 ' + pct + '%가 0보다 큽니다.'; },
    miss_lead: function (d, a, b, n, sp) { return d + 'm만 옮겨도 연간 햇빛이 ' + a + '%에서 ' + b + '%로 달라집니다. 각 칸은 그 지점에서 실제로 계산한 값입니다: ' + n + '개 지점, ' + sp + 'm 간격.'; },
    stat_target: '목표 지점의 햇빛', stat_best: function (d) { return '최적 지점, ' + d + 'm 거리'; }, stat_range: '250m 이내 범위', stat_worst: function (d) { return '최악 지점, ' + d + 'm 거리'; },
    range: function (a, b) { return a + ' ~ ' + b; },
    tip: function (s, e, sl, d) { return '햇빛 ' + s + '%<br>지구 가시 ' + e + '%<br>경사 ' + sl + '°<br>목표에서 ' + d + 'm'; },
    map_ring: '원: 목표에서 250m', map_key: '흰색: 목표   초록: 최적 지점',
    proof_best: function (p, d) { return p + '% (목표에서 ' + d + 'm)'; },
    cmp_head: ['후보지', '통과하는 착륙일, 목표 지점', '근처 최적 지점', '햇빛, 목표 / 최적', '지구 가시', '가장 긴 어둠'],
    cmp_cell: function (go, hold) { return '가능 ' + go + '일, 주의 ' + hold + '일'; }, not_computed: '계산 안 함',
    pick_title: '클릭한 지점', pick_where: function (d, dir, up) { return '목표에서 ' + dir + '쪽으로 ' + d + ', 높이 ' + up; },
    compass: ['북', '북동', '동', '남동', '남', '남서', '서', '북서'],
    pick_sun: '2027년 햇빛', pick_earth: '지구 가시', pick_dark: '가장 긴 어둠', pick_crew: '유인 착륙일', pick_robot: '로봇 착륙일',
    pick_outside: function (km) { return '우리가 계산한 ' + km + 'km 정사각형 밖입니다. 목표에 더 가까운 곳을 클릭하세요.'; },
    sun: '태양', earth: '지구', play: '재생', pause: '일시정지',
    tour: [
      'NASA의 LOLA 고도 지도로 만든 실제 달 남극입니다. 태양은 실제로 이만큼 낮게 떠 있습니다.',
      '초록색: 2027년에 유인 착륙이 가능한 날이 하루라도 있는 곳. 회색: 하루도 없는 곳.',
      '지면 2m 높이에서 본 모습입니다. 태양이 지평선을 스치다가 그 뒤로 사라집니다.'
    ]
  };

  /* Korean for the text written in index.html. English stays in the HTML itself. */
  var staticKo = [
    ['.tag', '임무가 움직이면, 달도 달라집니다.'],
    ['#help', '둘러보기'], ['#cam-orbit', '궤도 시점'], ['#cam-stand', '착륙지에 서 보기'],
    ['.sitecard .k', '착륙 후보지'],
    ['.readout .row:nth-child(1) .k', '보이는 태양 면적'], ['.readout .row:nth-child(2) .k', '지구'], ['.readout .row:nth-child(3) .k', '태양 중심'],
    ['.readout .row:nth-child(4) .k', '그 방향의 지형'], ['.readout .row:nth-child(5) .k', '가리는 지형'], ['.readout .row:nth-child(6) .k', '태양'], ['.readout .row:nth-child(7) .k', '지구'],
    ['#hud-right > div:nth-child(1)', '지면에 표시할 값'], ['#hud-right > div:nth-child(4)', '조명'],
    ['[data-layer="crew_go"]', '유인 가능일'], ['[data-layer="robot_go"]', '로봇 가능일'], ['[data-layer="sun_pct"]', '햇빛'], ['[data-layer="earth_pct"]', '지구 가시'], ['[data-layer="plain"]', '표시 안 함'],
    ['#light-survey', '탐사 조명'], ['#light-real', '실제 태양'],
    ['.tl-legend span:nth-child(1)', '<i class="sw sun"></i>햇빛'], ['.tl-legend span:nth-child(2)', '<i class="sw earth"></i>지구 가시'], ['.tl-legend span:nth-child(3)', '<i class="sw win"></i>임무 체류 기간'],
    ['[data-speed="6"]', '6시간/초'], ['[data-speed="24"]', '1일/초'], ['[data-speed="120"]', '5일/초'],
    ['#tour-stop', '다음'],
    ['#intro-eyebrow', 'NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator'],
    ['#intro-h1', '착륙선은 준비됐습니다. 발사가 3일 밀렸습니다. <em>임무는 여전히 가능할까요?</em>'],
    ['#intro-p', '달 남극에서는 태양이 지평선에서 2° 안쪽에 머뭅니다. 그래서 멀리 있는 능선 하나가 착륙선의 전력을 끊을 수 있습니다. 이 도구는 NASA 지형 데이터로 어떤 착륙일이 여전히 가능한지 보여줍니다.'],
    ['#readout-more', '자세히'],
    ['#tour-start', '20초로 보기'], ['#intro-skip', '직접 둘러보기'],
    ['#verdict h2', '임무는 여전히 가능한가?'], ['#verdict .lead', '임무에 필요한 조건을 정하고 착륙일을 고르세요. 답은 퍼센트가 아니라 신호등입니다. '],
    ['#preset-crew', '유인, 6일'], ['#preset-robot', '로봇, 14일'],
    ['label[for="in-stay"] span', '표면 체류 기간'], ['label[for="in-dark"] span', '견딜 수 있는 가장 긴 어둠'], ['label[for="in-earth"] span', '하루에 필요한 지구 통신 시간'],
    ['#k-slip', '버틸 수 있는 발사 지연'], ['#k-count', '2027년에 통과하는 착륙일'],
    ['.cal-head h3', '2027년의 모든 착륙일'],
    ['.legend span:nth-child(1)', '<i class="c go"></i>가능: 가장 나쁘게 잡아도 통과'], ['.legend span:nth-child(2)', '<i class="c hold"></i>주의: 운이 따라야만 통과'],
    ['.legend span:nth-child(3)', '<i class="c no"></i>불가: 운이 따라도 실패'], ['.legend span:nth-child(4)', '<i class="c na"></i>체류 기간이 데이터 범위를 벗어남'],
    ['#fine-cal', '모든 날짜를 두 번 판정합니다. 신중한 추정은 태양의 절반 넘게 지형 위로 나왔을 때만 햇빛으로 치고, 지구가 지형보다 0.5° 이상 높을 때만 보이는 것으로 칩니다. 너그러운 추정은 태양의 10분의 1만 보여도, 지구가 지형 바로 위에만 있어도 인정합니다. 초록은 둘 다 통과, 노랑은 너그러운 추정만 통과, 빨강은 둘 다 실패입니다.'],
    ['#compare h2', '이 조건에서는 어느 후보지인가?'], ['#compare .lead', '같은 임무 조건을 모든 후보지에 적용합니다. 위의 슬라이더를 바꾸면 숫자도 따라 바뀝니다.'],
    ['#horizon h2', '지평선이 모든 것을 결정합니다'],
    ['#horizon .lead', '달 남극에서는 태양이 약 2° 넘게 올라가지 않고, 지구도 약 7° 아래에 머뭅니다. 아래는 착륙지를 한 바퀴 둘러싼 지형의 윤곽이며, 태양과 지구를 지금 위치에 그렸습니다.'],
    ['#strip-full', '전체 360°'], ['#strip-zoom', '태양 주변 확대'],
    ['#fine-strip', '수평선 위 높이(도). 2°가 보이도록 세로 방향을 늘렸습니다. 주황색 점은 임무 체류 기간 동안 태양이 지나는 길입니다.'],
    ['#miss h2', '조금 빗나가 착륙한다면?'],
    ['#fine-miss', '2025년 3월, IM-2 착륙선은 목표에서 약 250m 떨어진 크레이터 안에 내렸고, 햇빛이 태양전지에 닿지 않아 약 13시간 만에 임무가 끝났습니다. 원은 그 거리를 나타냅니다.'],
    ['.scale span:last-child', '연간 햇빛 100%'],
    ['#proof h2', '숫자가 맞다는 것을 어떻게 아는가'],
    ['#h-limits', '이 도구가 보지 못하는 것'],
    ['#ul-limits', '<li><b>바위와 작은 크레이터.</b> 고도 지도의 픽셀이 80m입니다. 다음 단계는 궤도선 카메라 영상입니다.</li><li><b>온도.</b> 추위의 원인인 어둠 시간은 계산하지만, 열은 모델링하지 않습니다.</li><li><b>2027년만.</b> 극지의 햇빛 조건은 해마다 달라지므로 다른 해는 따로 계산해야 합니다.</li><li><b>태양 원반을 수평선으로 자릅니다.</b> 능선이 기울어 있으면 보이는 면적이 조금 달라집니다.</li><li><b>색칠한 지도는 한 지점 판정보다 거칩니다.</b> 방향을 0.5° 대신 1°마다 확인해서, 날짜 수가 며칠 다를 수 있습니다(목표 지점에서 12일과 10일).</li><li><b>지구의 위상과 지상국.</b> "지구 가시"는 시선이 닿는다는 뜻이지, 통신이 된다는 뜻은 아닙니다.</li>'],
    ['#h-data', '기반이 된 NASA 데이터'],
    ['#ul-data', '<li><b>LOLA 고도 지도</b>(달 남극, 픽셀당 80m, <span class="mono">LDEM_80S_80MPP_ADJ</span>), NASA 고다드 행성측지 데이터 아카이브. 지형 지평선과 3D 지형에 사용합니다.</li><li><b>JPL Horizons</b>, 2027년 매시간 착륙지에서 본 태양과 지구의 방향에 사용합니다.</li>'],
    ['#fine-data', '둘 중 하나라도 없으면 이 도구는 계산할 것이 없습니다. 우리는 NASA와 제휴하거나 NASA의 보증을 받지 않았습니다.'],
    ['#fine-ai', '코드의 일부는 AI 코딩 도구로 초안을 만들고, 팀이 실행·테스트·검토했습니다. 자세한 내용은 저장소의 <span class="mono">AI_USAGE.md</span>에 있습니다.'],
    ['#foot', 'LUNAR//SHIFT · NASA Space Apps Challenge 2026 · 서울 · 챌린지: Lunar Landing Site Navigator']
  ];
  var proofKo = {
    head: ['검증', '결과', '기대값'],
    rows: [
      ['매끈한 달, 눈높이 2m: 지평선이 내려가는 각도', '−0.0869° (기하학)'],
      ['매끈한 달, 눈높이 100m', '−0.6147° (기하학)'],
      ['50km 거리에 놓은 3km 높이의 벽', '2.520° ~ 2.604° (기하학, 지도 픽셀 크기 이내)'],
      ['정북과 정동에 놓은 산', '0°와 90°'],
      ['태양 중심이 정확히 지형선 위에 있을 때', '50%'],
      ['우리의 지도 투영과 NASA 파일 자체 정의의 비교', '80m 픽셀 하나보다 작아야 함'],
      ['JPL Horizons로 본 착륙지의 연간 태양 높이 범위', '이 위도에서 약 ±2.1°'],
      ['통과/실패 규칙을 파이썬과 자바스크립트로 따로 작성해 같은 데이터로 비교', '동일한 결과'],
      ['목표 근처에서 햇빛이 가장 좋은 지점, 2027년 연간 햇빛', 'NASA 연구는 이 능선의 최적 지점을 대략 70% 이상으로 보고']
    ]
  };

  window.LS_I18N = { en: en, ko: ko, staticKo: staticKo, proofKo: proofKo };
})();
