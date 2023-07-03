document.querySelector('#lite-shop-order').onsubmit = (e) => {
    e.prevent.Default();
    let username = document.querySelector('#username').value.trim();
    let phone = document.querySelector('#phone').value.trim();
    let email = document.querySelector('#email').value.trim();
    let address = document.querySelector('#address').value.trim();
    if (!document.querySelector('#rule').checked) {
        // c правилами не согласен
        console.log('HELLO');
        Swal.fire({
            title: 'Warning',
            text: 'Read and accept the rule',
            type: 'info',
            confirmButtonText: 'Ok'
        });
        return false;
    }
    if (username == '' || phone == '' || email == '' || address == '') {
        // не заполнены поля
           Swal.fire({
            title: 'Warning',
            text: 'Fill all fields',
            type: 'info',
            confirmButtonText: 'Ok'
        });
    }

    fetch('/finish-order', {
        method: 'POST',
        body: JSON.stringify({
            'username': username,
            'phone': phone,
            'email': email,
            'address': address,
            'key': JSON.parse(localStorage.getItem('cart')) //отправиди всю корзину ключи и колл, эт важно
        }),
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    })
        .then((res) => {
            return res.text();
        })
        .then((body) => {
            if (body == 1) {
            
            } else {

            }
    })
}