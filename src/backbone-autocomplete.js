/*
TODO
- hit 0 のときの表示
- model.get("label") が決め打ちなのを修正
- jquery ui 互換のインターフェイス
- stickkit 対応 (hidden 使う?)
- ロード時の selected
*/

// #query を元に fetch できる collection を指定する
Backbone.Autocomplete = {
  // @param input [HTMLInputElement]
  // @param options [Object]
  // @param options.collection [Backbone.Collection]
  create(input, options = {}) {
    const el = $("<div>");
    $(input).before(el);
    $(el).append(input);

    return new Backbone.Autocomplete.View(_({el: el}).extend(options));
  }
};

Backbone.Autocomplete.View = Backbone.View.extend({
  events: {
    "focus input": "onFocus",
    "blur input": "onBlur",
    "keydown input": "onKeyDown",
    "keyup input": "onKeyUp",
  },

  initialize(options) {
    this.input = this.$("input")[0];
    this.$input = $(this.input);
    this.collection = options.collection;
    this.createDropdownView();
    this.dropdownFocused = false;
    this.selected = null;

    // debug
    setInterval(() => {
      // console.log(this.selected)
    }, 1000);
  },

  createDropdownView() {
    this.dropdownView = new Backbone.Autocomplete.DropdownView({
      collection: this.collection,
      parent: this,
    });

    this.dropdownView.on("selected", this.onSelected, this);
    this.dropdownView.render();

    $(this.el).append(this.dropdownView.el);

    this.fetchCollection();
  },

  onFocus(e) {
    this.showDropdown();
  },

  onBlur(e) {
    if (!this.dropdownFocused) {
      this.hideDropdown();
      this.dropdownView.selectItemFocusedByKey();

      if (this.$input.val() === "") {
        this.selected = null;
      } else {
        if (this.selected) {
          this.$input.val(this.selected.get("label"));
        }
      }
    }
  },

  showDropdown(e){
    this.dropdownView.show()
  },

  hideDropdown(e) {
    this.dropdownView.hide();
    this.dropdownFocused = false;
  },

  onSelected(model) {
    this.selected = model;
    this.$input.val(model.get("label"));
    // debug
    console.log(model);
  },

  // キー長押しで繰り返し処理するため
  // 文字以外のキーは keydown で処理
  onKeyDown(e) {
    switch(e.originalEvent.code) {
      case "ArrowUp":
        e.preventDefault();
        this.dropdownView.focusUp();
        break;
      case "ArrowDown":
        e.preventDefault();
        this.dropdownView.focusDown();
        break;
      case "Enter":
        this.dropdownView.selectItemFocusedByKey();
        this.hideDropdown();
        break;
    }
  },

  // 入力後の文字列を使いたいので、文字のキーは keyup で処理
  onKeyUp(e) {
    switch(e.originalEvent.code) {
      case "ArrowUp":
        break;
      case "ArrowDown":
        break;
      case "Enter":
        break;
      default:
        this.fetchCollection();
    }
  },

  fetchCollection() {
    const old_query = this.collection.query
    const query = this.$input.val();
    if (old_query !== query) {
      this.collection.query = query;
      this.collection.fetch();
    }
  },
});

Backbone.Autocomplete.DropdownView = Backbone.View.extend({
  tagName: "ul",

  events: {
    "mousedown": "onMouseDown",
  },

  initialize(options) {
    this.collection = options.collection;
    delete options.collection;
    this.parent = options.parent;
    delete options.parent;
    this.options = options;
    this.itemViews = [];
  },

  render() {
    const $input = this.parent.$input;
    const parent_pos = $input.position();
    this.$el.addClass("backbone-autocomplete-dropdown")
            .css({
              fontSize: $input.css("font-size"),
              top: parent_pos.top + $input.outerHeight() - 1,
              minWidth: $input.innerWidth(),
            });
    this.resetOptions();
    this.collection.on("sync", this.resetOptions, this);
  },

  show() {
    this.$el.show();
  },

  hide() {
    this.$el.hide();
    this.parent.dropdownFocused = false;
  },

  resetOptions() {
    this.$el.empty();
    this.itemViews = [];
    this.selectedItemView = null;
    this.focusedItemView = null;

    this.collection.each(model => {
      const view = new Backbone.Autocomplete.DropdownItemView({model: model})
      view.on("selected", this.onSelected, this);
      view.on("focused", this.onFocused, this);
      view.render();
      this.$el.append(view.el);
      this.itemViews.push(view);
    });

    if (this.collection.length == 1) {
      this.itemViews[0].focus({by: "key"});
    }
  },

  focusDown() {
    this.focusRelative(1);
  },

  focusUp() {
    this.focusRelative(-1);
  },

  focusRelative(offset) {
    let view_will_be_focus;
    if (this.focusedItemView) {
      this.itemViews.forEach((v, i, list) => {
        if (v == this.focusedItemView) {
          view_will_be_focus = list[i + offset];
          return;
        }
      });
    } else {
      view_will_be_focus = this.itemViews[0];
    }

    if (view_will_be_focus) {
      if (this.focusedItemView) {
        this.focusedItemView.unfocus();
      }
      view_will_be_focus.focus({by: "key"});
    }
  },

  // キーボードで focus されていたら、click と同じ処理を開始
  selectItemFocusedByKey() {
    const item_view  = this.focusedItemView;
    if (item_view) {
      if (item_view.focusedBy === "key") {
        item_view.select();
      }
    }
  },

  onMouseDown() {
    this.parent.dropdownFocused = true;
  },

  onSelected(item_view) {
    // if (by === "click") {
      this.hide();
    // }

    // this.itemViews.forEach(v => {
    //   if (v !== item_view) {
    //     v.unfocus();
    //   }
    // });

    this.focusedItemView = item_view;
    this.selectedItemView = item_view;
    this.trigger("selected", item_view.model);
  },

  onFocused(item_view, {by = null}) {
    this.focusedItemView = item_view;

    if (by === "key") {
      const item_view_top = $(item_view.el).position().top;
      const item_view_height = $(item_view.el).outerHeight();
      const scroll_top = this.$el.scrollTop();

      if (item_view_top < 0) {
        // 上にはみ出した場合
        this.$el.scrollTop(scroll_top + item_view_top);
      } else if (this.$el.outerHeight() < (item_view_top + item_view_height)) {
        // 下にはみ出した場合
        this.$el.scrollTop(scroll_top + item_view_height);
      }
    }
  }
});

Backbone.Autocomplete.DropdownItemView = Backbone.View.extend({
  tagName: "li",
  events: {
    "mouseenter": "onMouseEnter",
    "mouseleave": "onMouseLeave",
    "click": "onClick",
  },

  render() {
    this.$el.text(this.model.get("label"));
  },

  select() {
    this.trigger("selected", this);
  },

  focus({by = null}) {
    this.$el.addClass("is-selected");
    this.focusedBy = by;
    this.trigger("focused", this, {by: by});
  },

  unfocus() {
    this.$el.removeClass("is-selected");
    this.focusedBy = false;
  },

  onMouseEnter() {
    this.focus({by: "mouse"});
  },

  onMouseLeave() {
    this.unfocus();
  },

  onClick() {
    this.select()
  },
});
