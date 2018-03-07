import * as $ from 'jquery';
import 'jquery-ui-bundle'


function update_widget(widget: any, values: any) {
  if (widget.hasClass("ui-slider")) {
    widget.slider('option', {
      min: 0,
      max: values.length-1,
      dim_vals: values,
      value: 0,
      dim_labels: values
    })
    widget.slider('option', 'slide').call(widget, event, {value: 0})
  } else {
    widget.empty();
    for (var i=0; i<values.length; i++){
      widget.append($("<option>", {
        value: i,
        text: values[i]
      }))
    };
    widget.data('values', values);
    widget.data('value', 0);
    widget.trigger("change");
  };
}

export
function init_slider(id: string, plot_id: string, dim: string, values: any, next_vals: any,
                     labels: number[], dynamic: boolean, step: number, value: any, next_dim: string,
                     dim_idx: number, delay: number = 500) {
  var vals = values;
  if (dynamic && vals.constructor === Array) {
    var default_value = parseFloat(value);
    var min = parseFloat(vals[0]);
    var max = parseFloat(vals[vals.length-1]);
    var wstep = step;
    var wlabels = [default_value];
    var init_label = default_value;
  } else {
    var min = 0;
    if (dynamic) {
      var max = Object.keys(vals).length - 1;
      var init_label = labels[value];
      var default_value: number = values[value];
    } else {
      var max = vals.length - 1;
      var init_label = labels[value];
      var default_value: number = value;
    }
    var wstep = 1;
    var wlabels = labels;
  }
  function adjustFontSize(text: any) {
    var width_ratio = (text.parent().width()/8)/text.val().length;
    var size = Math.min(0.9, Math.max(0.6, width_ratio))+'em';
    text.css('font-size', size);
  }
  var slider: any = $('#_anim_widget'+id+'_'+dim);
  slider.slider({
    animate: "fast",
    min: min,
    max: max,
    step: wstep,
    value: default_value,
    dim_vals: vals,
    dim_labels: wlabels,
    next_vals: next_vals,
    slide: function(event: any, ui: any) {
      var vals = slider.slider("option", "dim_vals");
      var next_vals = slider.slider("option", "next_vals");
      var dlabels = slider.slider("option", "dim_labels");
      if (dynamic) {
        var dim_val = ui.value;
        if (vals.constructor === Array) {
          var label = ui.value;
        } else {
          var label = dlabels[ui.value];
        }
      } else {
        var dim_val = vals[ui.value];
        var label = dlabels[ui.value];
      }
      var text = $('#textInput'+id+'_'+dim);
      text.val(label);
      adjustFontSize(text);
      (window as any).HoloViews.index[plot_id].set_frame(dim_val, dim_idx);
      if (Object.keys(next_vals).length > 0) {
        var new_vals = next_vals[dim_val];
        var next_widget = $('#_anim_widget'+id+'_'+next_dim);
        update_widget(next_widget, new_vals);
        }
    }
  });
  slider.keypress(function(event: any) {
    if (event.which == 80 || event.which == 112) {
      var start = slider.slider("option", "value");
      var stop =  slider.slider("option", "max");
      for (var i=start; i<=stop; i++) {
        var d = i*delay;
        $.proxy(function doSetTimeout(i: number) { setTimeout($.proxy(function() {
          var val = {value:i};
          slider.slider('value',i);
          slider.slider("option", "slide")(null, val);
        }, slider), d);}, slider)(i);
      }
    }
    if (event.which == 82 || event.which == 114) {
      var start = slider.slider("option", "value");
      var stop =  slider.slider("option", "min");
      var count = 0;
      for (var i=start; i>=stop; i--) {
        var d = count*delay;
        count = count + 1;
        $.proxy(function doSetTimeout(i: number) { setTimeout($.proxy(function() {
          var val = {value:i};
          slider.slider('value',i);
          slider.slider("option", "slide")(null, val);
        }, slider), d);}, slider)(i);
      }
    }
  });
  var textInput = $('#textInput'+id+'_'+dim)
  textInput.val(init_label);
  adjustFontSize(textInput);
}


export
function init_dropdown(id: string, plot_id: string, dim: string, vals: any,
                       value: number, next_vals: any, labels: any, next_dim: string,
                       dim_idx: number, dynamic: boolean) {
  var widget = $("#_anim_widget"+id+'_'+dim);
  widget.data('values', vals)
  for (var i=0; i<vals.length; i++){
    if (dynamic) {
      var val: any = vals[i];
    } else {
      var val: any = i;
    }
    widget.append($("<option>", {
      value: val,
      text: labels[i]
    }));
  };
  widget.data("next_vals", next_vals);
  widget.val(value);
  widget.on('change', function(event, ui) {
    if (dynamic) {
      var dim_val: any = parseInt(this.value);
    } else {
      var dim_val: any = $.data(this, 'values')[this.value];
    }
    var next_vals = $.data(this, "next_vals");
    if (Object.keys(next_vals).length > 0) {
      var new_vals = next_vals[dim_val];
      var next_widget = $('#_anim_widget'+id+'_'+next_dim);
      update_widget(next_widget, new_vals);
    }
    var widgets = (window as any).HoloViews.index[plot_id]
    if (widgets) {
      widgets.set_frame(dim_val, dim_idx);
    }
  });
}
