import './SmItem.css'

function SmItem({ image, title, created_at, onClick }) {
    return <div className="sm-item" onClick={onClick}>
        <div className="sm-item-image">
            <img src={image} alt={title} />
        </div>
        <div className="sm-item-info">
            <div className="sm-item-title">
                {title}
            </div>
            <div className="sm-item-date">
                {created_at}
            </div>
        </div>
    </div>
}

export default SmItem;