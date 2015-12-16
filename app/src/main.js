/**
 * @file FECS Editor main
 * @author cgzero(cgzero@cgzero.com)
 * @date 2015-12-17
 */
(function () {

    /**
     * FECS 主域
     *
     * @const
     * @type {string}
     */
    var FECS_HOST = 'http://fecs.baidu.com';

    /**
     * 代码检测、格式化地址
     *
     * @const
     * @type {Object}
     */
    var URL = {
        // 检测js地址
        CHECK_JS: FECS_HOST + '/check/js/default',
        // 检测css地址
        CHECK_CSS: FECS_HOST + '/check/css/default',
        // 检测html地址
        CHECK_HTML: FECS_HOST + '/check/html/default',
        // 检测less地址
        CHECK_LESS: FECS_HOST + '/check/less/default',
        // 检测js地址（使用baidu规范）
        CHECK_JS_BAIDU: FECS_HOST + '/check/js/baidu',
        // 检测css地址（使用baidu规范）
        CHECK_CSS_BAIDU: FECS_HOST + '/check/css/baidu',
        // 检测html地址（使用baidu规范）
        CHECK_HTML_BAIDU: FECS_HOST + '/check/html/baidu',
        // 检测less地址（使用baidu规范）
        CHECK_LESS_BAIDU: FECS_HOST + '/check/less/baidu',
        // 格式化js地址
        FORMAT_JS: FECS_HOST + '/format/js',
        // 格式化css地址
        FORMAT_CSS: FECS_HOST + '/format/css',
        // 格式化html地址
        FORMAT_HTML: FECS_HOST + '/format/html',
        // 格式化less地址
        FORMAT_LESS: FECS_HOST + '/format/less'
    };

    /**
     * 模板常量
     *
     * @const
     * @type {Object}
     */
    var TPL = {
        // fecs检查通过的信息
        CONSOLE_OK: '<div>fecs <span class="info">INFO</span> Congratulations! Everything is OK!</div>',
        // fecs检查出错的信息
        CONSOLE_WRAN: '<div>fecs ${serverity} ${info}</div>',
        // 代码检查时，每种类型错误所对应的模板
        SERVERITY: {
            1: '<span class="warn">&nbsp;WARN</span>',
            2: '<span class="err">ERROR</span>'
        }
    };

    /**
     * 各种文字提示信息
     *
     * @const
     * @type {Object}
     */
    var MSG = {
        // 检查错误时的提示信息
        CHECK_ERR: '服务器貌似出错了，无法检查代码:(',
        // 格式化错误时的提示信息
        FORMAT_ERR: '服务器貌似出错了，无法格式化代码:('
    };

    /**
     * 动态验证的延迟时间
     *
     * @const
     * @type {string}
     */
    var CHECK_DELAY_TIME = 500;

    /**
     * 检测代码所使用的 reporter
     * 1: default
     * 2: baidu
     *
     * @type {Number}
     */
    var currReporterType = 1;

    /**
     * ace编辑器
     *
     * @type {Object}
     */
    var ace = window.ace;

    /**
     * 为 checkCode 增加防抖功能
     *
     * @type {Function}
     */
    var checkCodeDebounce = debounce(CHECK_DELAY_TIME, checkCode);

    /**
     * 编辑器实例表
     *
     * @type {Object}
     */
    var editorMap = {};

    /**
     * 语言类型信息对应表
     *
     * @type {Object}
     */
    var langTypeMap = {
        javascript: {
            getCheckUrl: function () {
                if (currReporterType === 1) {
                    return URL.CHECK_JS;
                }
                else if (currReporterType === 2) {
                    return URL.CHECK_JS_BAIDU;
                }
            },
            formatUrl: URL.FORMAT_JS
        },
        css: {
            getCheckUrl: function () {
                if (currReporterType === 1) {
                    return URL.CHECK_CSS;
                }
                else if (currReporterType === 2) {
                    return URL.CHECK_CSS_BAIDU;
                }
            },
            formatUrl: URL.FORMAT_CSS
        },
        html: {
            getCheckUrl: function () {
                if (currReporterType === 1) {
                    return URL.CHECK_HTML;
                }
                else if (currReporterType === 2) {
                    return URL.CHECK_HTML_BAIDU;
                }
            },
            formatUrl: URL.FORMAT_HTML
        },
        less: {
            getCheckUrl: function () {
                if (currReporterType === 1) {
                    return URL.CHECK_LESS;
                }
                else if (currReporterType === 2) {
                    return URL.CHECK_LESS_BAIDU;
                }
            },
            formatUrl: URL.FORMAT_LESS
        }
    };

    /**
     * 编辑器menu
     *
     * @return {Object} 暴露的方法
     */
    var editerMenu = (function () {
        var state = 0;
        return {
            getState: function () {
                return state;
            },
            show: function () {
                $('.menu-btn').addClass('cur');
                $('.menu-list').show();
                state = 1;
            },
            hide: function () {
                $('.menu-btn').removeClass('cur');
                $('.menu-list').hide();
                state = 0;
            }
        };
    })();

    /**
     * 字符串格式化
     *
     * @inner
     * @param {string} tpl 模板
     * @param {Object} data 传入变量
     * @example
     *     stringFormat('你好，${foo}', {
     *         foo: '世界'
     *     });
     * @return {string} 格式化后的字符串
     */
    function stringFormat(tpl, data) {
        return tpl.replace(
            /\$\{([-a-z0-9_]+)\}/ig,
            function (all, name) {
                return data[name] || '';
            }
        );
    }

    /**
     * 对指定的函数进行包装，返回一个在指定的时间内一次的函数
     *
     * @inner
     * @param {number} wait 时间范围
     * @param {Function} fn 待包装函数
     * @return {Function} 包装后的函数
     */
    function debounce(wait, fn) {
        var timer;
        return function () {
            var ctx = this;
            var args = arguments;

            clearTimeout(timer);

            timer = setTimeout(
                function () {
                    fn.apply(ctx, args);
                },
                wait
            );
        };
    }

    /**
     * 初始化ACE编辑器
     *
     * @inner
     * @param {string} type 代码类型
     */
    function initAceEditor(type) {
        var editor = ace.edit(type + '-editor');

        editor.$blockScrolling = Infinity;
        editor.setTheme('ace/theme/monokai');

        editor.getSession().setUseWorker(false);
        editor.getSession().setMode('ace/mode/' + type);

        editor.setOption('wrap', false);
        editor.setOption('highlightActiveLine', false);

        var codeVal = editor.getSession().getValue();

        editor.commands.removeCommand('find');
        editor.commands.addCommand({
            name: 'format',
            bindKey: {
                win: 'Ctrl-Shift-F',
                mac: 'Command-Shift-F'
            },
            exec: function (editor, line) {
                formatCode(codeVal, type, function (data) {
                    editor.getSession().setValue(data.code);
                });
            },
            readOnly: true
        });

        // 初始化加载时不强制检测代码，减少请求
        // 如果有默认代码的话需要开启
        // checkCode(codeVal, type);
        editor.on('change', function (evt) {
            checkCodeDebounce(editor.getValue(), type);
        });

        editorMap[type] = editor;
    }

    /**
     * 获取当前展示的编辑器类型
     *
     * @inner
     * @return {string} 编辑器类型
     */
    function getCurrEditerType() {
        return $('.nav-item.cur').attr('data-for');
    }

    /**
     * 初始化编辑器事件
     *
     * @inner
     */
    function initEditorEvent() {
        // nav点击切换
        $('.nav-item').on('click', function () {
            var self = $(this);

            $('.nav-item').removeClass('cur');
            self.addClass('cur');

            var dataFor = self.attr('data-for');

            $('.fecs-editor').hide();
            $('.fecs-console').hide();
            $('#' + dataFor + '-editor').show();
            $('#' + dataFor + '-console').show();
        });

        // 格式化代码
        $('.format-btn').on('click', function (event) {
            var type = getCurrEditerType();
            var currEditer = editorMap[type];
            var code = currEditer.getSession().getValue();

            formatCode(code, type, function (data) {
                currEditer.getSession().setValue(data.code);
            });

            editerMenu.hide();
        });

        // 窗口尺寸变化时的处理函数
        var resizeEditor = function () {
            var restOfHeight = 150;

            if ($(window).width() < 700) {
                restOfHeight = 140;
            }

            $('.fecs-editor').height($(window).height() - restOfHeight);

            $.each(editorMap, function (key, editor) {
                editor.resize();
            });
        };

        // 初始化强制触发
        resizeEditor();
        // 窗口尺寸改变时绑定事件
        $(window).resize(resizeEditor);

        // 点击展开、隐藏菜单
        $('.menu-btn').on('click', function (evt) {
            // 如果菜单已经展开
            if (editerMenu.getState()) {
                return;
            }

            evt.stopPropagation();
            editerMenu.show();
        });
        $('body').on('click', function (evt) {
            // 如果菜单没有展开
            if (!editerMenu.getState()) {
                return;
            }

            // 如果点击了菜单里的区域
            if ($(evt.target).parents('.menu-list').size()) {
                return;
            }

            editerMenu.hide();
        });

        // menu hover 展开 submenu
        $('.menu-item').hover(
            function () {
                $(this)
                    .addClass('cur')
                    .find('.menu-sub-list').show();
            },
            function () {
                $(this)
                    .removeClass('cur')
                    .find('.menu-sub-list').hide();
            }
        );

        // 更换 reporter
        $('.reporter-btn').on('click', function (evt) {
            var self = $(this);

            var reporterType = parseInt(self.attr('data-type'), 10);
            $('.reporter-btn').removeClass('select');
            self.addClass('select');
            currReporterType = reporterType;
            editerMenu.hide();

            // 强制触发检测
            $.each(editorMap, function (key, editor) {
                checkCode(editor.getSession().getValue(), key);
            });

        });
    }

    /**
     * 初始化编辑器
     *
     * @inner
     */
    function initEditor() {
        initAceEditor('css');
        initAceEditor('html');
        initAceEditor('less');
        initAceEditor('javascript');
        initEditorEvent();

        if (navigator.platform === 'MacIntel') {
            $('.format-btn span').html('Cmd Shit F');
        }
    }

    /**
     * 展示代码验证结果
     *
     * @inner
     * @param {Object} data json返回数据
     * @param {string} type 代码类型
     */
    function showConsole(data, type) {
        var consoleTpl = '';
        var errList = [];

        if (!data.length) {
            consoleTpl = TPL.CONSOLE_OK;
        }
        else {
            $.each(data, function (i, item) {
                consoleTpl += stringFormat(TPL.CONSOLE_WRAN, {
                    serverity: TPL.SERVERITY[item.severity],
                    line: item.line,
                    col: item.column,
                    msg: item.message,
                    info: item.info
                });

                var severityType;
                switch (item.severity) {
                    case 1:
                        severityType = 'warning';
                        break;
                    case 2:
                        severityType = 'error';
                        break;
                }

                errList.push({
                    row: item.line - 1,
                    column: item.column,
                    text: $.trim(item.message),
                    type: severityType
                });
            });
        }

        $('#' + type + '-console').html(consoleTpl);

        editorMap[type].getSession().setAnnotations(errList);
    }

    /**
     * 验证代码
     *
     * @inner
     * @param {string} code 代码片段
     * @param {string} type 代码类型
     */
    function checkCode(code, type) {
        var params = {
            code: code
        };
        var url = langTypeMap[type].getCheckUrl();

        $.ajax({
            type: 'POST',
            url: url,
            data: params,
            dataType: 'json'
        })
        .then(
            function (data) {
                showConsole(data, type);
            },
            function () {
                alert(MSG.CHECK_ERR);
            }
        );
    }

    /**
     * 格式化代码
     *
     * @inner
     * @param {string} code 代码片段
     * @param {string} type 代码类型
     * @param {Function} callback 回调函数
     */
    function formatCode(code, type, callback) {
        var params = {
            code: code
        };
        var url = langTypeMap[type].formatUrl;

        $.ajax({
            type: 'POST',
            url: url,
            data: params,
            dataType: 'json'
        })
        .then(
            function (data) {
                if (callback) {
                    callback(data);
                }
            },
            function () {
                alert(MSG.FORMAT_ERR);
            }
        );
    }

    /**
     * 初始化
     *
     * @inner
     */
    function init() {
        initEditor();
    }

    init();
})();
